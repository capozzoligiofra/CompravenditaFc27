// "npm run sonda": chiede ai siti di dati FUT se ci lasciano entrare.
//
// Futbin risponde 403 a un programma: è un blocco esplicito e lo rispettiamo.
// Ma non è detto che valga per tutti — fut.gg, FUTWIZ e gli altri hanno
// politiche loro, e cambiano nel tempo. Invece di indovinare, si chiede.
//
// Per ogni sito la sonda fa quattro domande, in quest'ordine:
//   1. il nome si risolve? (se no, il problema è la tua rete)
//   2. cosa dice il suo robots.txt, che è il posto dove un sito scrive nero
//      su bianco cosa concede ai programmi;
//   3. il sito risponde a una richiesta onesta, o c'è una protezione anti-bot?
//   4. se e solo se il robots.txt lo consente, l'indirizzo dati indicato
//      restituisce JSON, e c'è dentro un prezzo?
//
// Cosa NON fa, e non farà: fingersi un browser, risolvere i controlli
// anti-bot, girare intorno a un divieto. Se un sito dice no, la sonda scrive
// «no» e passa oltre. Serve a trovare una porta aperta, non a forzarne una.
//
//   npm run sonda                      prova l'elenco predefinito
//   SONDA_SITI=https://tal.dev npm run sonda     prova solo quelli che dici tu

import { lookup } from 'node:dns/promises'

import { describeFetchError } from '../server/util.mjs'

const AGENTE = process.env.SONDA_AGENTE ?? 'fc27-trader/0.1 (uso personale; +https://github.com/capozzoligiofra/compravenditafc27)'
const TIMEOUT = Number(process.env.SONDA_TIMEOUT ?? 9000)

/**
 * I candidati. Gli indirizzi dati sono *tentativi*: percorsi plausibili da
 * provare, non promesse. Quello che conta è la risposta.
 */
const CANDIDATI = [
  { nome: 'fut.gg', base: 'https://www.fut.gg', dati: ['/api/fut/players/v2/', '/api/fut/player-prices/'] },
  { nome: 'FUTWIZ', base: 'https://www.futwiz.com', dati: ['/api/players', '/fc26/api/players'] },
  { nome: 'FUTBIN', base: 'https://www.futbin.com', dati: ['/api/playerPrices?player=1'] },
  { nome: 'futdatabase.com', base: 'https://www.futdatabase.com', dati: ['/api/players'] },
  { nome: 'fut-db.com', base: 'https://api.fut-db.com', dati: ['/api/players'] },
]

function siti() {
  const scelti = (process.env.SONDA_SITI ?? '').split(',').map((voce) => voce.trim()).filter(Boolean)
  if (scelti.length === 0) return CANDIDATI
  return scelti.map((indirizzo) => {
    const base = indirizzo.replace(/\/$/, '')
    return { nome: new URL(base).hostname, base, dati: ['/api', '/api/players'] }
  })
}

async function chiedi(url, extra = {}) {
  const risposta = await fetch(url, {
    headers: { 'user-agent': AGENTE, accept: extra.accept ?? '*/*' },
    redirect: 'follow',
    signal: AbortSignal.timeout(TIMEOUT),
  })
  const testo = await risposta.text().catch(() => '')
  return { status: risposta.status, testo, intestazioni: risposta.headers }
}

/** Una protezione anti-bot si riconosce, e quando c'è la strada finisce lì. */
function protezione(status, testo, intestazioni) {
  const corpo = (testo ?? '').toLowerCase()
  const server = (intestazioni?.get('server') ?? '').toLowerCase()
  if (intestazioni?.has('cf-mitigated')) return 'Cloudflare (sfida attiva)'
  if (corpo.includes('just a moment') || corpo.includes('cf-challenge') || corpo.includes('challenge-platform')) {
    return 'Cloudflare (pagina di verifica)'
  }
  if ((status === 403 || status === 503) && (server.includes('cloudflare') || intestazioni?.has('cf-ray'))) {
    return 'Cloudflare (blocco)'
  }
  if (status === 403) return 'accesso negato dal sito'
  if (status === 429) return 'troppe richieste (limite del servizio)'
  return null
}

/**
 * Il minimo indispensabile per leggere un robots.txt: i gruppi che ci
 * riguardano (il nostro agente e `*`), le regole Allow/Disallow, e la regola
 * più lunga che combacia — che è come lo interpretano i motori di ricerca.
 */
function leggiRobots(testo, agente = 'fc27-trader') {
  const righe = (testo ?? '').split('\n').map((riga) => riga.replace(/#.*$/, '').trim())
  const gruppi = []
  let corrente = null
  for (const riga of righe) {
    const [campoGrezzo, ...resto] = riga.split(':')
    if (resto.length === 0) continue
    const campo = campoGrezzo.trim().toLowerCase()
    const valore = resto.join(':').trim()
    if (campo === 'user-agent') {
      if (!corrente || corrente.regole.length > 0) {
        corrente = { agenti: [], regole: [] }
        gruppi.push(corrente)
      }
      corrente.agenti.push(valore.toLowerCase())
    } else if ((campo === 'allow' || campo === 'disallow') && corrente) {
      corrente.regole.push({ tipo: campo, percorso: valore })
    }
  }

  const nostro = agente.toLowerCase()
  const miei = gruppi.filter((gruppo) => gruppo.agenti.some((voce) => nostro.includes(voce) && voce !== '*'))
  const generici = gruppi.filter((gruppo) => gruppo.agenti.includes('*'))
  const validi = miei.length > 0 ? miei : generici
  const regole = validi.flatMap((gruppo) => gruppo.regole)

  return {
    trovato: righe.some((riga) => riga.length > 0),
    regole,
    /** Vietato tutto a tutti? È il «no» più netto che un sito possa scrivere. */
    chiusoDelTutto: regole.some((regola) => regola.tipo === 'disallow' && regola.percorso === '/'),
    consente(percorso) {
      let miglioreDivieto = -1
      let migliorePermesso = -1
      for (const regola of regole) {
        if (!regola.percorso) continue
        const confronto = regola.percorso.replace(/\*+$/, '')
        if (!percorso.startsWith(confronto)) continue
        if (regola.tipo === 'disallow') miglioreDivieto = Math.max(miglioreDivieto, confronto.length)
        else migliorePermesso = Math.max(migliorePermesso, confronto.length)
      }
      // A parità, e quando nessuna regola tocca il percorso, si passa.
      return migliorePermesso >= miglioreDivieto
    },
  }
}

function sembraPrezzo(dati) {
  const testo = JSON.stringify(dati ?? '').toLowerCase()
  return /"price"|"prices"|"lowestbin"|"ps"\s*:\s*\d|"xbox"\s*:\s*\d/.test(testo)
}

const esiti = []

console.log('')
console.log('Sonda delle sorgenti dati FUT')
console.log(`mi presento come: ${AGENTE}`)
console.log('')

for (const sito of siti()) {
  const host = new URL(sito.base).hostname
  console.log(`── ${sito.nome} (${host})`)

  try {
    const indirizzi = await lookup(host, { all: true })
    console.log(`   dns      ${indirizzi.map((voce) => voce.address).join(', ')}`)
  } catch (errore) {
    console.log(`   dns      NON risolve — ${describeFetchError(errore)}`)
    console.log('')
    esiti.push({ nome: sito.nome, verdetto: 'irraggiungibile' })
    continue
  }

  let robots = leggiRobots('')
  try {
    const risposta = await chiedi(`${sito.base}/robots.txt`)
    if (risposta.status === 200) {
      robots = leggiRobots(risposta.testo)
      const riassunto = robots.chiusoDelTutto
        ? 'vieta tutto ai programmi'
        : robots.regole.length === 0
          ? 'nessuna regola che ci riguardi'
          : `${robots.regole.length} regole per noi`
      console.log(`   robots   HTTP 200 · ${riassunto}`)
    } else {
      console.log(`   robots   HTTP ${risposta.status} (nessun robots.txt leggibile)`)
    }
  } catch (errore) {
    console.log(`   robots   non letto — ${describeFetchError(errore)}`)
  }

  let bloccato = null
  try {
    const risposta = await chiedi(sito.base)
    bloccato = protezione(risposta.status, risposta.testo, risposta.intestazioni)
    console.log(`   sito     HTTP ${risposta.status}${bloccato ? ` · ${bloccato}` : ' · risponde'}`)
  } catch (errore) {
    bloccato = describeFetchError(errore)
    console.log(`   sito     ${bloccato}`)
  }

  if (bloccato) {
    console.log('   → il sito non consente l\'accesso automatico: ci fermiamo qui.')
    console.log('')
    esiti.push({ nome: sito.nome, verdetto: 'bloccato', dettaglio: bloccato })
    continue
  }

  if (robots.chiusoDelTutto) {
    console.log('   → il robots.txt vieta l\'accesso automatico: ci fermiamo qui.')
    console.log('')
    esiti.push({ nome: sito.nome, verdetto: 'vietato dal robots.txt' })
    continue
  }

  let buono = null
  for (const percorso of sito.dati) {
    if (!robots.consente(percorso)) {
      console.log(`   dati     ${percorso} — vietato dal robots.txt, non lo chiedo`)
      continue
    }
    try {
      const risposta = await chiedi(`${sito.base}${percorso}`, { accept: 'application/json' })
      const fermo = protezione(risposta.status, risposta.testo, risposta.intestazioni)
      if (fermo) {
        console.log(`   dati     ${percorso} — HTTP ${risposta.status} · ${fermo}`)
        continue
      }
      let json = null
      try {
        json = JSON.parse(risposta.testo)
      } catch {
        json = null
      }
      if (risposta.status === 200 && json) {
        const conPrezzo = sembraPrezzo(json)
        console.log(`   dati     ${percorso} — HTTP 200 · JSON${conPrezzo ? ' CON prezzi' : ' ma senza prezzi'}`)
        console.log(`            esempio: ${JSON.stringify(json).slice(0, 140)}`)
        if (conPrezzo && !buono) buono = percorso
      } else {
        console.log(`   dati     ${percorso} — HTTP ${risposta.status}${json ? ' · JSON senza prezzi' : ' · non è JSON'}`)
      }
    } catch (errore) {
      console.log(`   dati     ${percorso} — ${describeFetchError(errore)}`)
    }
  }

  console.log('')
  esiti.push({ nome: sito.nome, verdetto: buono ? 'prezzi accessibili' : 'raggiungibile, prezzi no', percorso: buono })
}

console.log('───────────────────────────────')
for (const esito of esiti) {
  console.log(`${esito.nome.padEnd(18)} ${esito.verdetto}${esito.percorso ? ` (${esito.percorso})` : ''}`)
}
console.log('')

const vincente = esiti.find((esito) => esito.verdetto === 'prezzi accessibili')
if (vincente) {
  console.log(`Buone notizie: ${vincente.nome} risponde con i prezzi e senza divieti.`)
  console.log('Per collegarlo servono due variabili (indirizzo e, se richiesta, chiave):')
  console.log('vedi "Sorgente alternativa: un\'API con chiave" nel README, oppure lanciami')
  console.log('"npm run esplora" per farmi trovare i percorsi esatti.')
} else {
  console.log('Nessuna porta aperta, per ora: i prezzi restano quelli che scrivete voi')
  console.log('nel listino condiviso — che intanto funziona e non dipende da nessuno.')
}
console.log('Copiami questo riquadro così ragioniamo sui risultati veri.')
console.log('')
