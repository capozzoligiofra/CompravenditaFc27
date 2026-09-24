// Prezzi inseriti a mano.
//
// Sono la sorgente normale di questa app: Futbin e gli altri non consentono
// l'accesso ai programmi, quindi il prezzo lo si legge in gioco e lo si
// scrive qui — o lo scrive qualcun altro del listino condiviso. Tutto il
// resto (margini, target, stime, verdetti di vendita) ci lavora sopra
// esattamente come farebbe con una quotazione automatica.
//
// Regola: il prezzo scritto a mano vale quando non c'è una quotazione vera.
// Se la sorgente automatica funziona, vince lei, perché è aggiornata.

/**
 * Una sorgente automatica c'è, oppure no. 'locale' vuol dire che i prezzi
 * arrivano da voi — dal listino condiviso o da quello che hai scritto tu — ed
 * è la condizione normale, non un guasto.
 */
export function isLiveSource(source) {
  // 'demo' non lo produce più nessuno: resta riconosciuto perché il service
  // worker può servire una risposta messa in cache prima di questa versione.
  return Boolean(source) && source !== 'locale' && source !== 'demo'
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
 * @param source 'futbin' o 'api' con una sorgente automatica, 'locale' senza
 */
export function mergeQuotes(quotes = {}, manual = {}, source = 'locale') {
  const out = { ...quotes }
  for (const [id, entry] of Object.entries(manual)) {
    if (!entry || !entry.price) continue
    const esistente = out[id]
    const hasLive = isLiveSource(source) && esistente && esistente.price > 0
    if (!hasLive) out[id] = manualQuote(entry.price, entry.at, entry.autore ?? '')
  }
  return out
}
