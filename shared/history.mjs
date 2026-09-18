// Storico costruito in casa.
//
// Se la sorgente automatica è chiusa, lo storico dei prezzi non arriva da
// nessuna parte: senza, i segnali "sotto la media della settimana" e "vicino
// al minimo" non possono esistere. Però ogni prezzo che l'app vede — letto da
// una sorgente o scritto a mano — è un punto di storia. Annotandone uno al
// giorno per carta, dopo qualche giorno i segnali tornano a funzionare.

const GIORNO = 86_400_000
const MAX_PUNTI = 60

function giorno(timestamp) {
  return Math.floor(timestamp / GIORNO)
}

/** Aggiunge il prezzo di oggi, o aggiorna quello già annotato oggi. */
export function recordSnapshot(history = [], price, now = Date.now()) {
  const value = Math.round(Number(price) || 0)
  if (value <= 0) return history
  const punti = [...history]
  const ultimo = punti.at(-1)
  if (ultimo && giorno(ultimo.t) === giorno(now)) {
    if (ultimo.price === value) return history
    punti[punti.length - 1] = { t: now, price: value }
    return punti
  }
  punti.push({ t: now, price: value })
  return punti.slice(-MAX_PUNTI)
}

/** Vero se annotare questo prezzo cambierebbe qualcosa. */
export function needsSnapshot(history = [], price, now = Date.now()) {
  const value = Math.round(Number(price) || 0)
  if (value <= 0) return false
  const ultimo = history.at(-1)
  if (!ultimo) return true
  return giorno(ultimo.t) !== giorno(now) || ultimo.price !== value
}

export const MAX_PUNTI_STORICO = MAX_PUNTI
