// Prezzi inseriti a mano.
//
// Quando la sorgente automatica non è disponibile — Futbin che rifiuta le
// richieste, versione statica su Pages, nessuna rete — l'app non deve
// diventare inutile: il prezzo lo si legge in gioco e lo si scrive qui. Tutto
// il resto (margini, target, verdetti di vendita) funziona identico.
//
// Regola: il prezzo scritto a mano vale quando non c'è una quotazione vera.
// Se la sorgente automatica funziona, vince lei, perché è aggiornata.

/** Sorgenti vere contro dataset demo: 'futbin', 'futdb' o quel che verrà. */
export function isLiveSource(source) {
  return Boolean(source) && source !== 'demo'
}

/**
 * @param autore chi l'ha segnato, quando non sei tu: con il listino condiviso
 *   il prezzo può arrivare da un'altra persona, ed è giusto vederlo scritto.
 */
export function manualQuote(price, at, autore = '') {
  const value = Math.max(0, Math.round(Number(price) || 0))
  const chi = autore ? `da ${autore}` : 'da te'
  return {
    price: value,
    minPrice: value,
    maxPrice: value,
    changePercent: 0,
    updated: at ? `inserito ${chi} il ${new Date(at).toLocaleDateString('it-IT')}` : `inserito ${chi}`,
    manual: true,
    autore,
  }
}

/**
 * @param quotes quotazioni ricevute dalla sorgente (possono mancare)
 * @param manual prezzi scritti a mano (tuoi o del listino condiviso), per identificativo
 * @param source 'futbin' quando i prezzi sono veri, 'demo' altrimenti
 */
export function mergeQuotes(quotes = {}, manual = {}, source = 'demo') {
  const out = { ...quotes }
  for (const [id, entry] of Object.entries(manual)) {
    if (!entry || !entry.price) continue
    const esistente = out[id]
    const hasLive = isLiveSource(source) && esistente && esistente.price > 0
    if (!hasLive) out[id] = manualQuote(entry.price, entry.at, entry.autore ?? '')
  }
  return out
}
