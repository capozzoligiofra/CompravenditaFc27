// Elenchi di prezzi in JSON.
//
// L'app accetta già un elenco `Nome prezzo` riga per riga; questo è lo stesso
// mestiere per chi i prezzi li tiene in un foglio, in uno script o in un
// appunto strutturato. Quello che arriva viene trattato come un'osservazione
// scritta da chi la incolla: l'app non sa e non chiede da dove venga.
//
// Si accetta il JSON com'è più facile averlo, non come sarebbe elegante:
//   - l'elenco completo  [ {...}, {...} ]
//   - o solo il pezzo in mezzo, senza parentesi  {...}, {...}
//   - con la virgola di troppo in fondo
//   - con le chiavi in italiano o in inglese
//   - con i prezzi scritti come 8.2K, 14K, 1,2M, 44.000 o 44000

import { parseCoinsLoose } from './roster-import.mjs'
import { normalizeName } from './text.mjs'

const MAX_VOCI = 2000

const CHIAVI_NOME = ['nome', 'name', 'giocatore', 'player', 'nomeGiocatore', 'playerName']
const CHIAVI_PREZZO = ['prezzo', 'price', 'valore', 'value', 'bin', 'lowestBin']
const CHIAVI_VALUTAZIONE = ['valutazione', 'rating', 'overall', 'ovr']

function primoValore(voce, chiavi) {
  for (const chiave of chiavi) {
    if (voce[chiave] !== undefined && voce[chiave] !== null && voce[chiave] !== '') return voce[chiave]
  }
  // Le chiavi possono arrivare con maiuscole diverse: si riprova a occhi chiusi.
  const minuscole = Object.fromEntries(Object.entries(voce).map(([k, v]) => [k.toLowerCase(), v]))
  for (const chiave of chiavi) {
    const valore = minuscole[chiave.toLowerCase()]
    if (valore !== undefined && valore !== null && valore !== '') return valore
  }
  return undefined
}

/** Rende analizzabile anche un pezzo di JSON copiato a metà. */
function ripulisci(testo) {
  const pulito = String(testo ?? '').trim()
  if (!pulito) return ''
  // Una virgola penzolante in fondo, e quelle prima di una parentesi di
  // chiusura, sono i refusi più comuni di un copia-incolla: JSON non le ammette.
  return pulito.replace(/,\s*$/, '').replace(/,(\s*[}\]])/g, '$1')
}

/**
 * Prima si prova a leggerlo com'è; se non è JSON valido si riprova
 * racchiudendolo fra parentesi quadre, che è il caso di chi ha copiato solo
 * le righe in mezzo all'elenco.
 */
function analizza(pulito) {
  try {
    return { dati: JSON.parse(pulito) }
  } catch (problema) {
    try {
      return { dati: JSON.parse(`[${pulito}]`) }
    } catch {
      return { errore: problema }
    }
  }
}

function elenco(dati) {
  if (Array.isArray(dati)) return dati
  if (!dati || typeof dati !== 'object') return []
  for (const chiave of ['giocatori', 'players', 'prezzi', 'prices', 'items', 'data']) {
    if (Array.isArray(dati[chiave])) return dati[chiave]
  }
  // Una carta sola, copiata da sé: è un elenco di uno.
  if (primoValore(dati, CHIAVI_NOME) !== undefined) return [dati]
  return []
}

/**
 * Legge l'elenco e restituisce voci pulite, più il conto di ciò che ha
 * scartato: un import silenzioso che perde metà delle righe è peggio di uno
 * che si ferma e lo dice.
 *
 * @returns { voci, errore, scartate, duplicate }
 */
export function leggiElencoJson(testo) {
  const pulito = ripulisci(testo)
  if (!pulito) return { voci: [], errore: null, scartate: 0, duplicate: 0 }

  const { dati, errore } = analizza(pulito)
  if (errore) {
    return {
      voci: [],
      errore: `Non riesco a leggere il JSON: ${errore instanceof Error ? errore.message : 'formato non valido'}`,
      scartate: 0,
      duplicate: 0,
    }
  }

  const righe = elenco(dati)
  if (righe.length === 0) {
    return { voci: [], errore: 'Nessun elenco di giocatori trovato in questo JSON.', scartate: 0, duplicate: 0 }
  }

  const viste = new Set()
  const voci = []
  let scartate = 0
  let duplicate = 0

  for (const riga of righe.slice(0, MAX_VOCI)) {
    if (!riga || typeof riga !== 'object') {
      scartate += 1
      continue
    }
    const nome = String(primoValore(riga, CHIAVI_NOME) ?? '').trim().replace(/\s+/g, ' ')
    const prezzo = parseCoinsLoose(primoValore(riga, CHIAVI_PREZZO))
    const valutazioneGrezza = Number(primoValore(riga, CHIAVI_VALUTAZIONE))
    const valutazione = Number.isFinite(valutazioneGrezza) ? Math.max(0, Math.min(99, Math.round(valutazioneGrezza))) : 0

    if (!nome || !(prezzo > 0)) {
      scartate += 1
      continue
    }
    const chiave = `${normalizeName(nome)}|${valutazione}`
    if (viste.has(chiave)) {
      duplicate += 1
      continue
    }
    viste.add(chiave)
    voci.push({ name: nome, rating: valutazione, price: prezzo })
  }

  return { voci, errore: null, scartate, duplicate }
}
