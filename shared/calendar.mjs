// Il ciclo settimanale di Ultimate Team, che è la prima causa dei movimenti
// di prezzo: quando arrivano premi e pacchetti il mercato si riempie di carte
// e i prezzi scendono, quando si gioca la Champions la domanda risale.
//
// Orari in ora italiana. EA pubblica in orario UK: promo e Champions
// partono venerdì alle 18:00 UK, cioè le 19:00 da noi.

const PHASES = {
  'crollo-premi': {
    id: 'crollo-premi',
    label: 'Premi in consegna',
    advice: 'Tutti aprono pacchetti: il mercato si riempie e i prezzi scendono. È il momento di comprare.',
    bias: 3,
  },
  'pre-promo': {
    id: 'pre-promo',
    label: 'Vigilia della promo',
    advice: 'Molti svendono la rosa per fare crediti in vista della promo: prezzi ai minimi settimanali.',
    bias: 3,
  },
  'hype-promo': {
    id: 'hype-promo',
    label: 'Uscita promo e Champions',
    advice: 'Domanda al massimo su carte meta e fodder: è la finestra per vendere ciò che hai comprato.',
    bias: -3,
  },
  'weekend-league': {
    id: 'weekend-league',
    label: 'Weekend League in corso',
    advice: 'Si gioca: si compra per completare la rosa, i prezzi tengono. Vendere va ancora bene.',
    bias: -2,
  },
  notte: {
    id: 'notte',
    label: 'Ore di calma',
    advice: 'Pochi acquirenti online: è la fascia migliore per trovare carte sotto prezzo.',
    bias: 2,
  },
  'mid-settimana': {
    id: 'mid-settimana',
    label: 'Metà settimana',
    advice: 'Mercato tranquillo: si accumula in vista del fine settimana.',
    bias: 1,
  },
}

/** Giorno e ora in Italia, indipendentemente dal fuso del dispositivo. */
export function romeParts(date) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Rome',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]))
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return {
    weekday: Math.max(0, days.indexOf(String(parts.weekday))),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
  }
}

/**
 * In che fase del ciclo siamo adesso. L'ordine dei controlli conta: le fasi
 * più specifiche (premi, promo) vincono su quelle generiche.
 */
export function currentPhase(now = new Date()) {
  const { weekday, hour } = romeParts(now)

  // Giovedì mattina chiude la Champions e arrivano i premi.
  if (weekday === 4 && hour >= 9 && hour < 18) return PHASES['crollo-premi']
  // Lunedì mattina i premi Rivals.
  if (weekday === 1 && hour >= 9 && hour < 14) return PHASES['crollo-premi']
  // Da giovedì sera fino all'uscita della promo del venerdì.
  if ((weekday === 4 && hour >= 18) || (weekday === 5 && hour < 19)) return PHASES['pre-promo']
  // Venerdì sera: promo e Champions aprono insieme.
  if ((weekday === 5 && hour >= 19) || (weekday === 6 && hour < 12)) return PHASES['hype-promo']
  if (weekday === 6 || weekday === 0) return PHASES['weekend-league']
  if (hour >= 1 && hour < 8) return PHASES.notte
  return PHASES['mid-settimana']
}

const WEEKLY = [
  {
    weekday: 4,
    hour: 9,
    label: 'Premi Champions',
    detail: 'Chiude la Weekend League: ondata di pacchetti, prezzi in calo.',
    effect: 'offerta',
  },
  {
    weekday: 5,
    hour: 19,
    label: 'Nuova promo + Champions',
    detail: 'Uscita contenuti e apertura Weekend League: picco di domanda sulle carte meta.',
    effect: 'domanda',
  },
  {
    weekday: 1,
    hour: 9,
    label: 'Premi Rivals',
    detail: 'Seconda ondata di pacchetti della settimana: piccolo calo dei prezzi.',
    effect: 'offerta',
  },
  {
    weekday: 3,
    hour: 19,
    label: 'Aggiornamento settimanale',
    detail: 'Nuove carte squadra della settimana e SBC infrasettimanali.',
    effect: 'offerta',
  },
]

/** I prossimi appuntamenti fissi, per il conto alla rovescia in pagina. */
export function upcomingEvents(now = new Date(), count = 4) {
  const events = []
  for (const entry of WEEKLY) {
    for (let week = 0; week < 2; week += 1) {
      const at = nextOccurrence(now, entry.weekday, entry.hour, week)
      events.push({
        id: `${entry.label}-${at}`,
        label: entry.label,
        detail: entry.detail,
        at,
        effect: entry.effect,
      })
    }
  }
  return events
    .filter((event) => event.at > now.getTime())
    .sort((a, b) => a.at - b.at)
    .slice(0, count)
}

/**
 * Prossima occorrenza di un giorno/ora italiani. Si procede per tentativi di
 * un'ora invece di fare i conti sul fuso: così cambi d'ora e ora legale
 * vengono gestiti dal calendario di sistema e non da noi.
 */
function nextOccurrence(now, weekday, hour, weekOffset) {
  const start = new Date(now.getTime())
  start.setMinutes(0, 0, 0)
  for (let step = 1; step <= 24 * 15; step += 1) {
    const candidate = new Date(start.getTime() + step * 3_600_000)
    const parts = romeParts(candidate)
    if (parts.weekday === weekday && parts.hour === hour) {
      if (weekOffset === 0) return candidate.getTime()
      return candidate.getTime() + weekOffset * 7 * 86_400_000
    }
  }
  return now.getTime() + 7 * 86_400_000
}
