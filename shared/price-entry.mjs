// L'elenco delle carte a cui serve un prezzo.
//
// Se i prezzi li scrivi tu, il lavoro vero non è il singolo numero: è sapere
// quali carte hanno un prezzo vecchio e quali non l'hanno mai avuto, senza
// andarle a cercare una per una. Qui si mette insieme tutto ciò che l'app
// conosce — rosa, watchlist, schede aperte — e si ordina per urgenza.

import { normalizeName } from './text.mjs'

const ORA = 3_600_000

/** Oltre queste ore un prezzo non si usa più a occhi chiusi. */
export const ORE_FRESCHEZZA = 24

/**
 * Da quanto è vecchia l'osservazione: 'mai' se non c'è, 'oggi' se è dentro
 * la finestra di freschezza, 'vecchio' oltre.
 */
export function statoPrezzo(osservatoIl, now = Date.now()) {
  if (!osservatoIl) return 'mai'
  return now - osservatoIl <= ORE_FRESCHEZZA * ORA ? 'oggi' : 'vecchio'
}

function aggiungi(mappa, player, gruppo) {
  if (!player?.id) return
  const id = String(player.id)
  const voce = mappa.get(id) ?? {
    id,
    name: player.name ?? '',
    rating: Number(player.rating) || 0,
    ruolo: player.position ?? '',
    club: player.club ?? '',
    versione: player.version ?? '',
    gruppi: [],
    quantita: 0,
  }
  // Il nome migliore è quello più completo: la rosa incollata a volte ha solo
  // il cognome, la scheda aperta ha il nome intero.
  if ((player.name ?? '').length > voce.name.length) voce.name = player.name
  if (!voce.rating && player.rating) voce.rating = Number(player.rating) || 0
  if (!voce.gruppi.includes(gruppo)) voce.gruppi.push(gruppo)
  mappa.set(id, voce)
}

/**
 * Tutte le carte per cui ha senso chiedere un prezzo, ordinate per urgenza:
 * prima quelle senza prezzo, poi quelle con il prezzo più vecchio.
 */
export function vociPrezzo({
  seen = [],
  watchlist = [],
  positions = [],
  manualPrices = {},
  priceHistory = {},
  now = Date.now(),
} = {}) {
  const mappa = new Map()
  for (const position of positions) {
    if (position?.sellPrice != null) continue
    aggiungi(mappa, { id: position.playerId, name: position.name, rating: position.rating }, 'rosa')
    const voce = mappa.get(String(position.playerId))
    if (voce) voce.quantita += Number(position.quantity) || 1
  }
  for (const item of watchlist) aggiungi(mappa, item, 'watchlist')
  for (const player of seen) aggiungi(mappa, player, 'visto')

  const voci = []
  for (const voce of mappa.values()) {
    const manuale = manualPrices[voce.id] ?? null
    const storico = (priceHistory[voce.id] ?? []).filter((punto) => punto?.price > 0)
    const ultimo = storico.at(-1) ?? null
    // Fra il prezzo scritto a mano e l'ultimo punto di storico vince il più
    // recente: possono arrivare da strade diverse.
    const daManuale = manuale?.price > 0 ? { price: manuale.price, at: manuale.at ?? 0 } : null
    const daStorico = ultimo ? { price: ultimo.price, at: ultimo.t } : null
    const osservazione =
      daManuale && daStorico ? (daManuale.at >= daStorico.at ? daManuale : daStorico) : (daManuale ?? daStorico)

    voci.push({
      ...voce,
      prezzo: osservazione?.price ?? 0,
      osservatoIl: osservazione?.at ?? 0,
      scrittoAMano: Boolean(daManuale) && osservazione === daManuale,
      punti: storico.length,
      stato: statoPrezzo(osservazione?.at ?? 0, now),
    })
  }

  return ordinaVoci(voci)
}

/**
 * Prima il vuoto, poi il vecchio: l'ordine in cui conviene lavorarle.
 *
 * `chiave` permette di ordinare per un'anzianità diversa da quella attuale.
 * Serve al pannello: le righe appena salvate devono restare dove sono,
 * altrimenti scappano da sotto le dita mentre si scrive.
 */
export function ordinaVoci(voci, chiave = (voce) => voce.osservatoIl) {
  return [...voci].sort((a, b) => {
    const ka = chiave(a) || 0
    const kb = chiave(b) || 0
    if (!ka !== !kb) return ka ? 1 : -1
    if (ka !== kb) return ka - kb
    return (b.rating || 0) - (a.rating || 0)
  })
}

/**
 * Filtro del pannello: gruppo di appartenenza e ricerca per nome.
 *
 * `tieni` è l'elenco delle carte da mostrare comunque, qualunque sia il
 * gruppo: sono quelle sistemate poco fa, che sparirebbero subito da «da
 * aggiornare» facendo saltare la riga su cui si sta scrivendo.
 */
export function filtraVoci(voci, { gruppo = 'tutte', testo = '', tieni = [] } = {}) {
  const cercato = normalizeName(testo)
  const salvate = new Set(tieni)
  return voci.filter((voce) => {
    if (cercato && !normalizeName(voce.name).includes(cercato)) return false
    if (salvate.has(voce.id)) return true
    if (gruppo === 'rosa' && !voce.gruppi.includes('rosa')) return false
    if (gruppo === 'watchlist' && !voce.gruppi.includes('watchlist')) return false
    if (gruppo === 'da-aggiornare' && voce.stato === 'oggi') return false
    return true
  })
}

/** Due numeri per sapere a che punto sei. */
export function riepilogo(voci) {
  return {
    totale: voci.length,
    aggiornate: voci.filter((voce) => voce.stato === 'oggi').length,
    daAggiornare: voci.filter((voce) => voce.stato !== 'oggi').length,
    mai: voci.filter((voce) => voce.stato === 'mai').length,
  }
}
