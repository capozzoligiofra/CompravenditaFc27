// "npm run esplora": scopre come è fatta l'API del servizio che hai scelto.
//
// Ogni servizio di dati FUT ha la sua forma: indirizzo base, intestazione per
// la chiave, percorso della ricerca, percorso dei prezzi. Invece di
// indovinare dal codice — che è l'errore già fatto una volta — qui si provano
// le combinazioni più comuni dalla tua connessione e si stampa la
// configurazione esatta da usare.
//
//   FUT_API_KEY=la-tua-chiave npm run esplora
//   FUT_API_KEY=... FUT_API_SITE=https://esempio.tld npm run esplora
//
// Le richieste sono poche, distanziate e con la tua chiave, su un servizio a
// cui ti sei iscritto: è esplorazione della documentazione, non forzatura.

import { describeFetchError } from '../server/util.mjs'

const CHIAVE = process.env.FUT_API_KEY ?? process.env.FUTDB_KEY ?? ''
const SITO = (process.env.FUT_API_SITE ?? process.env.FUT_API_BASE ?? 'https://fut-db.com').replace(/\/$/, '')
const NOME_PROVA = process.env.ESPLORA_PLAYER ?? 'haaland'
const PAUSA_MS = Number(process.env.ESPLORA_PAUSA_MS ?? 300)
const MAX_RICHIESTE = Number(process.env.ESPLORA_MAX ?? 60)

if (!CHIAVE) {
  console.log('')
  console.log('Serve la chiave. Windows (PowerShell):')
  console.log('')
  console.log('  $env:FUT_API_KEY="la-tua-chiave"; npm run esplora')
  console.log('')
  process.exit(1)
}

const basi = [...new Set([SITO, `${SITO}/api`, `${SITO}/v1`, `${SITO}/api/v1`])]

const autenticazioni = [
  { nome: 'X-AUTH-TOKEN', headers: (key) => ({ 'X-AUTH-TOKEN': key }) },
  { nome: 'Authorization: Bearer', headers: (key) => ({ authorization: `Bearer ${key}` }) },
  { nome: 'X-API-KEY', headers: (key) => ({ 'X-API-KEY': key }) },
]

const ricerche = [
  { path: '/players/search', param: 'name' },
  { path: '/players', param: 'name' },
  { path: '/players', param: 'search' },
  { path: '/search', param: 'query' },
]

let richiesteFatte = 0

function attesa(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function chiama(url, headers) {
  if (richiesteFatte >= MAX_RICHIESTE) throw new Error('limite di richieste raggiunto')
  richiesteFatte += 1
  await attesa(PAUSA_MS)
  try {
    const risposta = await fetch(url, {
      headers: { accept: 'application/json', ...headers },
      signal: AbortSignal.timeout(9000),
    })
    const testo = await risposta.text()
    let dati = null
    try {
      dati = JSON.parse(testo)
    } catch {
      dati = null
    }
    return { status: risposta.status, dati, testo }
  } catch (error) {
    return { status: 0, errore: describeFetchError(error), dati: null, testo: '' }
  }
}

/** Un elenco di giocatori può stare sotto chiavi diverse, o essere la radice. */
function elencoGiocatori(dati) {
  if (Array.isArray(dati)) return dati
  if (!dati || typeof dati !== 'object') return []
  for (const chiave of ['items', 'data', 'results', 'players', 'player']) {
    if (Array.isArray(dati[chiave])) return dati[chiave]
  }
  return []
}

function sembraGiocatore(voce) {
  if (!voce || typeof voce !== 'object') return false
  const chiavi = Object.keys(voce).map((chiave) => chiave.toLowerCase())
  return chiavi.some((chiave) => chiave.includes('name')) && chiavi.some((chiave) => chiave.includes('rating') || chiave.includes('overall'))
}

console.log('')
console.log(`Esplorazione di ${SITO}`)
console.log(`chiave: ${CHIAVE.slice(0, 4)}… (${CHIAVE.length} caratteri)`)
console.log('')

let trovato = null
let vistoRifiutoChiave = false

for (const base of basi) {
  if (trovato) break
  let baseIrraggiungibile = false
  for (const autenticazione of autenticazioni) {
    if (trovato || baseIrraggiungibile) break
    for (const ricerca of ricerche) {
      if (trovato || richiesteFatte >= MAX_RICHIESTE) break
      const url = `${base}${ricerca.path}?${ricerca.param}=${encodeURIComponent(NOME_PROVA)}`
      const esito = await chiama(url, autenticazione.headers(CHIAVE))
      const giocatori = elencoGiocatori(esito.dati)
      const buono = esito.status === 200 && giocatori.some(sembraGiocatore)
      const etichetta = `${autenticazione.nome} · ${ricerca.path}?${ricerca.param}=`
      if (buono) {
        console.log(`[ SÌ ] ${base}  ${etichetta}`)
        console.log(`       ${giocatori.length} risultati · esempio: ${JSON.stringify(giocatori[0]).slice(0, 160)}`)
        trovato = { base, autenticazione, ricerca, giocatore: giocatori.find(sembraGiocatore) }
      } else if (esito.status === 0) {
        // Se il sito non risponde proprio, inutile provare altre combinazioni
        // su questo indirizzo: si passa al successivo.
        console.log(`[ no ] ${base} — ${esito.errore}`)
        baseIrraggiungibile = true
        break
      } else {
        if (esito.status === 401 || esito.status === 403) vistoRifiutoChiave = true
        const indizio =
          esito.status === 200
            ? 'risponde ma non sembra un elenco di giocatori'
            : esito.testo.slice(0, 70).replace(/\s+/g, ' ')
        console.log(`[ no ] ${base}  ${etichetta} — HTTP ${esito.status} ${indizio}`)
      }
    }
  }
}

if (!trovato) {
  console.log('')
  console.log(`Nessuna combinazione ha funzionato (${richiesteFatte} richieste).`)
  if (vistoRifiutoChiave) {
    console.log('La chiave è arrivata al servizio ma è stata rifiutata: controlla di averla copiata')
    console.log("per intero e che l'intestazione sia quella giusta.")
  } else {
    console.log("Il servizio non ha mai risposto a un indirizzo valido: forse la base è diversa")
    console.log('da quelle provate. Passami quella giusta con FUT_API_SITE.')
  }
  console.log('Copiami queste righe e, se ce l\'hai, un pezzo della documentazione del servizio:')
  console.log('basta l\'indirizzo di esempio di una chiamata e il nome dell\'intestazione della chiave.')
  console.log('')
  process.exit(0)
}

// Trovata la ricerca, si cerca il percorso dei prezzi usando un giocatore vero.
const id = String(
  trovato.giocatore.id ?? trovato.giocatore.playerId ?? trovato.giocatore.resourceId ?? trovato.giocatore.baseId ?? '',
)

console.log('')
if (!id) {
  console.log('Il giocatore trovato non ha un identificativo riconoscibile: mandami la riga di esempio qui sopra.')
  process.exit(0)
}

const prezzi = [`/players/${id}/price`, `/players/${id}/prices`, `/prices/${id}`, `/players/${id}`]
let prezzoTrovato = null

for (const path of prezzi) {
  if (prezzoTrovato || richiesteFatte >= MAX_RICHIESTE) break
  const esito = await chiama(`${trovato.base}${path}`, trovato.autenticazione.headers(CHIAVE))
  const testo = JSON.stringify(esito.dati ?? '').toLowerCase()
  const haPrezzi = esito.status === 200 && /"ps"|"xbox"|"pc"|price/.test(testo)
  if (haPrezzi) {
    console.log(`[ SÌ ] prezzi su ${path}`)
    console.log(`       ${JSON.stringify(esito.dati).slice(0, 200)}`)
    prezzoTrovato = path.replace(id, '{id}')
  } else {
    console.log(`[ no ] prezzi su ${path} — HTTP ${esito.status}`)
  }
}

console.log('')
console.log('Configurazione da usare (Windows PowerShell):')
console.log('')
console.log(`  $env:FUT_API_BASE="${trovato.base}"`)
console.log(`  $env:FUT_API_KEY="la-tua-chiave"`)
console.log(`  $env:FUT_API_KEY_HEADER="${trovato.autenticazione.nome.replace('Authorization: Bearer', 'authorization')}"`)
console.log(`  $env:FUT_API_SEARCH_PATH="${trovato.ricerca.path}"`)
console.log(`  $env:FUT_API_SEARCH_PARAM="${trovato.ricerca.param}"`)
if (prezzoTrovato) console.log(`  $env:FUT_API_PRICE_PATH="${prezzoTrovato}"`)
console.log('  npm run dev')
console.log('')

if (!prezzoTrovato) {
  console.log('I prezzi non sono stati trovati: mandami l\'output e il pezzo di documentazione sui prezzi.')
  console.log('')
}
console.log(`Richieste fatte: ${richiesteFatte}.`)
console.log('')
