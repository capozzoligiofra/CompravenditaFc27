// "npm run diagnosi": prova uno per uno i collegamenti a Futbin dalla tua
// connessione e dice cosa funziona e cosa no.
//
// Serve perché il proxy, quando qualcosa non va, ripiega in silenzio sul
// prezzi che avete già: questo comando invece mostra l'errore vero, così si capisce
// se è la rete, un endpoint cambiato o un blocco di Futbin.

import { lookup } from 'node:dns/promises'

import { fetchGraph, fetchPrices, providerConfig, searchPlayers } from '../server/providers.mjs'
import { fetchCatalysts } from '../server/catalysts.mjs'
import { describeFetchError } from '../server/util.mjs'

const NOME_PROVA = process.env.DIAGNOSI_PLAYER ?? 'haaland'

const esiti = []

async function prova(nome, descrizione, azione) {
  const inizio = Date.now()
  try {
    const risultato = await azione()
    console.log(`[ OK ] ${nome} (${Date.now() - inizio} ms)`)
    if (risultato) console.log(`       ${risultato}`)
    esiti.push({ nome, ok: true })
    return true
  } catch (error) {
    const messaggio = error instanceof Error ? error.message : String(error)
    console.log(`[ NO ] ${nome}`)
    console.log(`       errore: ${messaggio}`)
    console.log(`       ${descrizione}`)
    esiti.push({ nome, ok: false, errore: messaggio })
    return false
  }
}

const nome = providerConfig.name === 'api' ? (providerConfig.label ?? 'API configurata') : 'Futbin'

console.log('')
console.log(`Diagnosi della sorgente dati: ${nome}`)
console.log(
  `sito: ${providerConfig.base}${providerConfig.name === 'futbin' ? ` · anno configurato: FC${providerConfig.configuredYear}` : ''}`,
)
console.log('')

if (!providerConfig.enabled) {
  if (providerConfig.name === 'api') {
    console.log("Sorgente API scelta ma non configurata: servono indirizzo e chiave.")
    console.log('')
    console.log('  Windows (PowerShell)   $env:FUT_API_BASE="https://esempio/api"; $env:FUT_API_KEY="chiave"')
    console.log('  macOS e Linux          FUT_API_BASE=https://esempio/api FUT_API_KEY=chiave npm run diagnosi')
    console.log('')
    console.log('Vedi il README: servono anche i percorsi di ricerca e prezzi se diversi da quelli standard.')
  } else {
    console.log("Futbin è disattivato (FUTBIN_ENABLED=false): l'app userà solo i prezzi che scrivete voi.")
  }
  console.log('')
  process.exit(0)
}

// Prima di tutto: il computer arriva a Futbin? Senza questa distinzione un
// "fetch failed" può essere tutto, dal DNS all'antivirus che ispeziona il
// traffico cifrato.
console.log(`node ${process.version} · ${process.platform}`)
console.log('')

const host = new URL(providerConfig.base).hostname

await prova('DNS', 'Il computer non riesce nemmeno a tradurre il nome in un indirizzo.', async () => {
  const indirizzi = await lookup(host, { all: true })
  return `${host} → ${indirizzi.map((voce) => voce.address).join(', ')}`
})

/**
 * Un 403 può arrivare da Futbin (protezione anti-bot) oppure da un filtro
 * locale: antivirus, controllo genitori, rete aziendale. Sono due problemi
 * diversi con due rimedi diversi, e si distinguono solo leggendo chi risponde.
 */
function riconosciBlocco(testo, intestazioni) {
  const corpo = testo.toLowerCase()
  const server = (intestazioni.get('server') ?? '').toLowerCase()
  if (corpo.includes('cloudflare') || server.includes('cloudflare') || intestazioni.has('cf-ray')) {
    return 'è Cloudflare, cioè la protezione anti-bot del sito'
  }
  if (/kaspersky|avast|eset|bitdefender|norton|mcafee|sophos|fortinet|zscaler|squid|proxy|blocked|bloccat/.test(corpo)) {
    return 'sembra un filtro locale (antivirus, controllo genitori o rete)'
  }
  return 'origine non riconosciuta'
}

await prova(`Connessione a ${nome}`, 'Il sito non risponde a questo computer: firewall, antivirus o blocco.', async () => {
  let risposta
  try {
    risposta = await fetch(providerConfig.base, {
      headers: { 'user-agent': process.env.FUTBIN_USER_AGENT ?? 'fc27-trader/0.1 (uso personale)' },
      signal: AbortSignal.timeout(9000),
    })
  } catch (error) {
    throw new Error(describeFetchError(error))
  }
  // Su un'API la radice spesso non esiste: un 404 o un 401 dicono comunque
  // che il server è raggiungibile, ed è questo che stiamo verificando.
  if (risposta.status === 403 || risposta.status === 503 || risposta.status >= 500) {
    const testo = await risposta.text().catch(() => '')
    const chi = riconosciBlocco(testo, risposta.headers)
    const titolo = testo.match(/<title[^>]*>([^<]{0,80})/i)?.[1]?.trim()
    throw new Error(
      `HTTP ${risposta.status} ${risposta.statusText} — ${chi}${titolo ? ` · pagina: "${titolo}"` : ''}`,
    )
  }
  if (risposta.status >= 400) {
    return `HTTP ${risposta.status} sulla radice: normale per un'API, il server risponde`
  }
  return `HTTP ${risposta.status}: il sito risponde`
})

await prova(
  'Internet in generale',
  'Se fallisce anche questo, il problema non è la sorgente ma la connessione o un filtro.',
  async () => {
    // Due sentinelle invece di una: se un sito ha problemi suoi, l'altro evita
    // una diagnosi sbagliata.
    const sentinelle = (process.env.DIAGNOSI_SENTINELLE ?? 'https://example.com,https://api.github.com')
      .split(',')
      .map((voce) => voce.trim())
      .filter(Boolean)
    const problemi = []
    for (const sito of sentinelle) {
      try {
        const risposta = await fetch(sito, { signal: AbortSignal.timeout(9000) })
        if (risposta.ok) return `${new URL(sito).hostname} risponde: la connessione funziona`
        problemi.push(`${new URL(sito).hostname} HTTP ${risposta.status}`)
      } catch (error) {
        problemi.push(`${new URL(sito).hostname}: ${describeFetchError(error)}`)
      }
    }
    throw new Error(problemi.join(' · '))
  },
)

console.log('')

let idTrovato = null

await prova('Ricerca giocatori', "Se fallisce, la ricerca resta quella del catalogo che avete costruito voi.", async () => {
  const trovati = await searchPlayers(NOME_PROVA)
  if (trovati.length === 0) throw new Error(`Nessun risultato per "${NOME_PROVA}"`)
  idTrovato = trovati[0].id
  const nota =
    providerConfig.name !== 'futbin'
      ? nome
      : providerConfig.year === providerConfig.configuredYear
        ? `anno FC${providerConfig.year}`
        : `anno FC${providerConfig.year} (trovato da solo: il FC${providerConfig.configuredYear} non risponde)`
  return `${trovati.length} risultati · primo: ${trovati[0].name} (${trovati[0].rating}, id ${trovati[0].id}) · ${nota}`
})

if (idTrovato) {
  await prova('Prezzi', "Se fallisce, l'app mostra le carte senza quotazione.", async () => {
    const prezzi = await fetchPrices(idTrovato)
    const ps = prezzi.ps
    if (ps && /abbonamento/i.test(ps.updated ?? '')) {
      throw new Error(
        'i prezzi di questo servizio sono riservati agli abbonati: la ricerca funziona, i prezzi si scrivono a mano',
      )
    }
    if (!ps || ps.price <= 0) throw new Error('Prezzo PlayStation non valido o a zero')
    return `PS ${ps.price} · Xbox ${prezzi.xbox?.price ?? 0} · PC ${prezzi.pc?.price ?? 0} · aggiornato: ${ps.updated}`
  })

  if (providerConfig.hasHistory) {
    await prova('Storico prezzi', 'Senza storico i consigli restano ad affidabilità bassa.', async () => {
      const storico = await fetchGraph(idTrovato, 'ps')
      if (storico.length < 3) throw new Error(`Solo ${storico.length} punti: troppo pochi per i segnali`)
      const ultimo = storico.at(-1)
      return `${storico.length} punti · ultimo: ${ultimo.price} del ${new Date(ultimo.t).toLocaleDateString('it-IT')}`
    })
  } else {
    console.log(`[ -- ] Storico prezzi: ${nome} non lo fornisce, se lo costruisce l'app annotando un prezzo al giorno.`)
  }
} else {
  console.log('[ -- ] Prezzi e storico: saltati, serve prima un giocatore dalla ricerca.')
}

if (providerConfig.name === 'futbin') {
await prova(
  'SBC e obiettivi',
  "Senza, i catalizzatori vanno inseriti a mano dall'app (che funziona comunque).",
  async () => {
    const catalizzatori = await fetchCatalysts()
    if (catalizzatori.length === 0) throw new Error('Nessuna SBC o obiettivo riconosciuto sulle pagine')
    const primi = catalizzatori.slice(0, 3).map((item) => item.title).join(' · ')
    return `${catalizzatori.length} riconosciuti · ${primi}`
  },
)
} else {
  console.log('[ -- ] SBC e obiettivi: si leggono solo da Futbin, con FutDB si aggiungono a mano dall\'app.')
}

const falliti = esiti.filter((esito) => !esito.ok)
console.log('')
if (falliti.length === 0) {
  console.log(`Tutto a posto: l'app userà i prezzi veri di ${nome}.`)
} else {
  console.log(`${falliti.length} controlli su ${esiti.length} non passano: ${falliti.map((e) => e.nome).join(', ')}.`)
  console.log('')
  console.log('Cosa vogliono dire gli errori più comuni:')
  console.log('  403 / 503                  Il sito blocca le richieste automatiche (protezione anti-bot).')
  console.log('  429                        Hai superato il limite di richieste: aspetta e riprova.')
  console.log("  401                        Chiave mancante o rifiutata.")
  console.log("  non in formato JSON        L'indirizzo risponde una pagina: percorso sbagliato.")
  console.log(
    providerConfig.name === 'futbin'
      ? "  404                        L'indirizzo non esiste più: prova FUT_YEAR=26 npm run diagnosi."
      : '  404                        Percorso inesistente: controlla FUT_API_SEARCH_PATH e FUT_API_PRICE_PATH.',
  )
  console.log('  ENOTFOUND / EAI_AGAIN      Il DNS non risolve: connessione o DNS del computer.')
  console.log('  ECONNREFUSED / ECONNRESET  Qualcosa chiude la connessione: firewall o rete.')
  console.log('  ETIMEDOUT / TimeoutError   Nessuna risposta in tempo: rete lenta o traffico filtrato.')
  console.log('  UNABLE_TO_VERIFY_LEAF_SIGNATURE, SELF_SIGNED_CERT_IN_CHAIN')
  console.log("                             Un antivirus o la rete aziendale ispezionano il traffico cifrato.")
  console.log('                             Disattiva la scansione HTTPS oppure indica il certificato con')
  console.log('                             NODE_EXTRA_CA_CERTS.')
  console.log('  UND_ERR_CONNECT_TIMEOUT    Connessione bloccata prima di partire: spesso un proxy.')
  const problemaCertificati = esiti.some(
    (esito) => esito.errore && /UNABLE_TO_VERIFY|SELF_SIGNED|CERT_/i.test(esito.errore),
  )
  if (problemaCertificati) {
    console.log('')
    console.log('Certificati: Node non si fida di quelli installati su questo computer.')
    console.log('Di solito è un antivirus che ispeziona il traffico cifrato. Prova così:')
    console.log('')
    console.log('  Windows (PowerShell)   $env:NODE_OPTIONS="--use-system-ca"; npm run diagnosi')
    console.log('  Windows (Prompt)       set NODE_OPTIONS=--use-system-ca && npm run diagnosi')
    console.log('  macOS e Linux          NODE_OPTIONS=--use-system-ca npm run diagnosi')
    console.log('')
    console.log('Se funziona, usa la stessa variabile anche per "npm run dev" e "npm run mobile".')
  }

  const limiteRichieste = esiti.some((esito) => esito.errore && /Troppe richieste|429/.test(esito.errore))
  if (limiteRichieste) {
    console.log('')
    console.log('Il servizio ha risposto «troppe richieste»: la chiave funziona e il collegamento')
    console.log('pure, hai solo esaurito le richieste consentite per ora. Aspetta qualche minuto')
    console.log('(o il rinnovo giornaliero del piano) e riprova questo stesso comando.')
  }

  const bloccoLocale = esiti.some((esito) => esito.errore && /filtro locale/.test(esito.errore))
  if (bloccoLocale) {
    console.log('')
    console.log('Il 403 sembra arrivare da un filtro sul tuo computer o sulla tua rete, non da Futbin.')
    console.log('Controlla antivirus, controllo genitori o firewall: se il sito si apre nel browser')
    console.log('ma non da qui, spesso basta escludere Node dalla scansione del traffico.')
  }

  const bloccoFutbin =
    providerConfig.name === 'futbin' &&
    esiti.some((esito) => esito.errore && /40[13]|503/.test(esito.errore)) &&
    !bloccoLocale
  if (bloccoFutbin) {
    console.log('')
    console.log('Futbin risponde 403: rifiuta le richieste che non arrivano da un browser.')
    console.log("Non c'è un modo pulito di aggirarlo, e travestire l'app da browser non è una")
    console.log('strada che vale la pena prendere. In compenso puoi scrivere i prezzi a mano:')
    console.log("nella scheda di un giocatore c'è il campo «Prezzo visto in gioco», e da lì")
    console.log('margini, target, occasioni e verdetti di vendita funzionano come sempre.')
    console.log('')
    console.log("In alternativa si può collegare un'API che consenta l'accesso programmatico:")
    console.log('imposta FUT_API_BASE e FUT_API_KEY e riprova (vedi README).')
  }

  console.log('')
  console.log("L'app resta usabile: mostra il badge DATI DEMO e lavora sul dataset incluso.")
}
console.log('')
