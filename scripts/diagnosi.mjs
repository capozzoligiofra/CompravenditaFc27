// "npm run diagnosi": prova uno per uno i collegamenti a Futbin dalla tua
// connessione e dice cosa funziona e cosa no.
//
// Serve perché il proxy, quando qualcosa non va, ripiega in silenzio sul
// dataset demo: questo comando invece mostra l'errore vero, così si capisce
// se è la rete, un endpoint cambiato o un blocco di Futbin.

import { lookup } from 'node:dns/promises'

import { fetchGraph, fetchPrices, futbinConfig, searchPlayers } from '../server/futbin.mjs'
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

console.log('')
console.log('Diagnosi del collegamento a Futbin')
console.log(`sito: ${futbinConfig.base} · anno configurato: FC${futbinConfig.configuredYear}`)
console.log('')

if (!futbinConfig.enabled) {
  console.log("Futbin è disattivato (FUTBIN_ENABLED=false): l'app userà solo il dataset demo.")
  console.log('')
  process.exit(0)
}

// Prima di tutto: il computer arriva a Futbin? Senza questa distinzione un
// "fetch failed" può essere tutto, dal DNS all'antivirus che ispeziona il
// traffico cifrato.
console.log(`node ${process.version} · ${process.platform}`)
console.log('')

const host = new URL(futbinConfig.base).hostname

await prova('DNS', 'Il computer non riesce nemmeno a tradurre il nome in un indirizzo.', async () => {
  const indirizzi = await lookup(host, { all: true })
  return `${host} → ${indirizzi.map((voce) => voce.address).join(', ')}`
})

await prova('Connessione a Futbin', 'Il sito non risponde a questo computer: firewall, antivirus o blocco.', async () => {
  try {
    const risposta = await fetch(futbinConfig.base, {
      headers: { 'user-agent': process.env.FUTBIN_USER_AGENT ?? 'fc27-trader/0.1 (uso personale)' },
      signal: AbortSignal.timeout(9000),
    })
    if (!risposta.ok) throw new Error(`HTTP ${risposta.status} ${risposta.statusText}: il sito rifiuta la richiesta`)
    return `HTTP ${risposta.status}: il sito risponde`
  } catch (error) {
    throw new Error(describeFetchError(error))
  }
})

await prova('Internet in generale', 'Se fallisce anche questo, il problema non è Futbin ma la connessione o un proxy.', async () => {
  try {
    const risposta = await fetch('https://example.com', { signal: AbortSignal.timeout(9000) })
    if (!risposta.ok) throw new Error(`example.com risponde HTTP ${risposta.status}`)
    return 'la connessione funziona'
  } catch (error) {
    throw new Error(describeFetchError(error))
  }
})

console.log('')

let idTrovato = null

await prova('Ricerca giocatori', "Se fallisce, l'app non trova nessuno e ricade sulla demo.", async () => {
  const trovati = await searchPlayers(NOME_PROVA)
  if (trovati.length === 0) throw new Error(`Nessun risultato per "${NOME_PROVA}"`)
  idTrovato = trovati[0].id
  const nota =
    futbinConfig.year === futbinConfig.configuredYear
      ? `anno FC${futbinConfig.year}`
      : `anno FC${futbinConfig.year} (trovato da solo: il FC${futbinConfig.configuredYear} non risponde)`
  return `${trovati.length} risultati · primo: ${trovati[0].name} (${trovati[0].rating}, id ${trovati[0].id}) · ${nota}`
})

if (idTrovato) {
  await prova('Prezzi', "Se fallisce, l'app mostra le carte senza quotazione.", async () => {
    const prezzi = await fetchPrices(idTrovato)
    const ps = prezzi.ps
    if (!ps || ps.price <= 0) throw new Error('Prezzo PlayStation non valido o a zero')
    return `PS ${ps.price} · Xbox ${prezzi.xbox?.price ?? 0} · PC ${prezzi.pc?.price ?? 0} · aggiornato: ${ps.updated}`
  })

  await prova('Storico prezzi', 'Senza storico i consigli restano ad affidabilità bassa.', async () => {
    const storico = await fetchGraph(idTrovato, 'ps')
    if (storico.length < 3) throw new Error(`Solo ${storico.length} punti: troppo pochi per i segnali`)
    const ultimo = storico.at(-1)
    return `${storico.length} punti · ultimo: ${ultimo.price} del ${new Date(ultimo.t).toLocaleDateString('it-IT')}`
  })
} else {
  console.log('[ -- ] Prezzi e storico: saltati, serve prima un giocatore dalla ricerca.')
}

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

const falliti = esiti.filter((esito) => !esito.ok)
console.log('')
if (falliti.length === 0) {
  console.log("Tutto a posto: l'app userà i prezzi veri di Futbin.")
} else {
  console.log(`${falliti.length} controlli su ${esiti.length} non passano: ${falliti.map((e) => e.nome).join(', ')}.`)
  console.log('')
  console.log('Cosa vogliono dire gli errori più comuni:')
  console.log('  403 / 503                  Futbin blocca le richieste automatiche (protezione anti-bot).')
  console.log("  non in formato JSON        L'indirizzo risponde una pagina: endpoint cambiato.")
  console.log("  404                        L'indirizzo non esiste più: prova FUT_YEAR=26 npm run diagnosi.")
  console.log('  ENOTFOUND / EAI_AGAIN      Il DNS non risolve: connessione o DNS del computer.')
  console.log('  ECONNREFUSED / ECONNRESET  Qualcosa chiude la connessione: firewall o rete.')
  console.log('  ETIMEDOUT / TimeoutError   Nessuna risposta in tempo: rete lenta o traffico filtrato.')
  console.log('  UNABLE_TO_VERIFY_LEAF_SIGNATURE, SELF_SIGNED_CERT_IN_CHAIN')
  console.log("                             Un antivirus o la rete aziendale ispezionano il traffico cifrato.")
  console.log('                             Disattiva la scansione HTTPS oppure indica il certificato con')
  console.log('                             NODE_EXTRA_CA_CERTS.')
  console.log('  UND_ERR_CONNECT_TIMEOUT    Connessione bloccata prima di partire: spesso un proxy.')
  console.log('')
  console.log("L'app resta usabile: mostra il badge DATI DEMO e lavora sul dataset incluso.")
}
console.log('')
