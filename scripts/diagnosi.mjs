// "npm run diagnosi": prova uno per uno i collegamenti a Futbin dalla tua
// connessione e dice cosa funziona e cosa no.
//
// Serve perché il proxy, quando qualcosa non va, ripiega in silenzio sul
// dataset demo: questo comando invece mostra l'errore vero, così si capisce
// se è la rete, un endpoint cambiato o un blocco di Futbin.

import { fetchGraph, fetchPrices, futbinConfig, searchPlayers } from '../server/futbin.mjs'
import { fetchCatalysts } from '../server/catalysts.mjs'

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
console.log(`sito: ${futbinConfig.base} · anno gioco: FC${futbinConfig.year}`)
console.log('')

if (!futbinConfig.enabled) {
  console.log("Futbin è disattivato (FUTBIN_ENABLED=false): l'app userà solo il dataset demo.")
  console.log('')
  process.exit(0)
}

let idTrovato = null

await prova('Ricerca giocatori', "Se fallisce, l'app non trova nessuno e ricade sulla demo.", async () => {
  const trovati = await searchPlayers(NOME_PROVA)
  if (trovati.length === 0) throw new Error(`Nessun risultato per "${NOME_PROVA}"`)
  idTrovato = trovati[0].id
  return `${trovati.length} risultati · primo: ${trovati[0].name} (${trovati[0].rating}, id ${trovati[0].id})`
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
  console.log('  403 / 503             Futbin sta bloccando la richiesta (protezione anti-bot).')
  console.log("  non in formato JSON   L'indirizzo risponde una pagina: endpoint cambiato.")
  console.log("  404                   L'indirizzo non esiste più: cambia FUTBIN_*_URL o FC27_YEAR.")
  console.log('  timeout / ENOTFOUND   Problema di rete o DNS dal tuo computer.')
  console.log('')
  console.log("L'app resta usabile: mostra il badge DATI DEMO e lavora sul dataset incluso.")
}
console.log('')
