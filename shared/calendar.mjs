// Il ciclo settimanale di Ultimate Team, che è la prima causa dei movimenti
// di prezzo: quando arrivano premi e pacchetti il mercato si riempie di carte
// e i prezzi scendono, quando si gioca la Champions la domanda risale.
//
// Orari in ora italiana. EA pubblica in orario UK: promo e Champions
// partono venerdì alle 18:00 UK, cioè le 19:00 da noi.
//
// **Gli orari non sono una legge di natura.** EA li cambia fra un capitolo e
// l'altro, e a volte a stagione in corso: per anni i premi Rivals sono
// arrivati di lunedì, poi sono passati al giovedì. Per questo il calendario
// non è più scolpito nel codice — sono quattro appuntamenti che l'utente può
// correggere dalle Opzioni, e quelli qui sotto sono solo il punto di
// partenza. Se l'app dice che i premi arrivano fra due giorni e tu li hai
// appena ricevuti, è questo il posto dove si aggiusta, e non serve
// aggiornare l'app per farlo.

/**
 * Gli appuntamenti fissi della settimana: giorno (0 = domenica) e ora
 * italiana. Sono i valori di partenza per FC27, non una verità: EA li sposta
 * e chi gioca se ne accorge prima di qualunque codice.
 *
 *   premi Rivals      giovedì mattina (in FC27 è il reset settimanale)
 *   fine Champions    lunedì mattina, quando la Weekend League chiude
 *   promo             venerdì sera, con l'apertura della Champions
 *   infrasettimanale  mercoledì sera, squadra della settimana e SBC
 */
export const CALENDARIO_PREDEFINITO = {
  premiRivals: { weekday: 4, hour: 9 },
  premiChampions: { weekday: 1, hour: 9 },
  promo: { weekday: 5, hour: 20 },
  infrasettimanale: { weekday: 3, hour: 19 },
}

/** Etichette e spiegazioni dei quattro appuntamenti, per l'interfaccia. */
export const APPUNTAMENTI = [
  {
    chiave: 'premiRivals',
    label: 'Premi Rivals',
    detail: 'Il reset settimanale: ondata di pacchetti, il mercato si riempie e i prezzi scendono.',
    effect: 'offerta',
  },
  {
    chiave: 'premiChampions',
    label: 'Fine Champions e premi',
    detail: 'Chiude la Weekend League e si incassano i premi: seconda ondata di pacchetti.',
    effect: 'offerta',
  },
  {
    chiave: 'promo',
    label: 'Nuova promo + Champions',
    detail: 'Uscita contenuti e apertura Champions: picco di domanda sulle carte meta.',
    effect: 'domanda',
  },
  {
    chiave: 'infrasettimanale',
    label: 'Aggiornamento settimanale',
    detail: 'Nuove carte squadra della settimana e SBC infrasettimanali.',
    effect: 'offerta',
  },
]

/** Un calendario valido comunque, anche se arriva mezzo vuoto da un backup. */
export function normalizzaCalendario(calendario) {
  const pulito = {}
  for (const { chiave } of APPUNTAMENTI) {
    const voce = calendario?.[chiave]
    const base = CALENDARIO_PREDEFINITO[chiave]
    const weekday = Number(voce?.weekday)
    const hour = Number(voce?.hour)
    pulito[chiave] = {
      weekday: Number.isInteger(weekday) && weekday >= 0 && weekday <= 6 ? weekday : base.weekday,
      hour: Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : base.hour,
    }
  }
  return pulito
}

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

/** Quante ore sono passate dall'ultima volta che è capitato quel giorno/ora. */
function oreDa(adesso, appuntamento) {
  const distanza = (adesso.weekday - appuntamento.weekday + 7) % 7
  return distanza * 24 + (adesso.hour - appuntamento.hour)
}

/** Quante ore mancano al prossimo. */
function oreA(adesso, appuntamento) {
  const ore = oreDa(adesso, appuntamento)
  return ore === 0 ? 0 : 168 - ore
}

/** Per quante ore dopo l'arrivo dei premi il mercato resta pieno di carte. */
const DURATA_PREMI = 6
/** Da quanto prima della promo la gente comincia a svendere. */
const ANTICIPO_PREPROMO = 24
/** Quanto dura la spinta subito dopo l'uscita della promo. */
const DURATA_HYPE = 15

/**
 * In che fase del ciclo siamo adesso, secondo il calendario configurato.
 * L'ordine dei controlli conta: le fasi più specifiche (premi, promo) vincono
 * su quelle generiche.
 */
export function currentPhase(now = new Date(), calendario = CALENDARIO_PREDEFINITO) {
  const quando = normalizzaCalendario(calendario)
  const adesso = romeParts(now)

  const daRivals = oreDa(adesso, quando.premiRivals)
  const daChampions = oreDa(adesso, quando.premiChampions)
  if (daRivals >= 0 && daRivals < DURATA_PREMI) return PHASES['crollo-premi']
  if (daChampions >= 0 && daChampions < DURATA_PREMI) return PHASES['crollo-premi']

  const allaPromo = oreA(adesso, quando.promo)
  if (allaPromo > 0 && allaPromo <= ANTICIPO_PREPROMO) return PHASES['pre-promo']

  const dallaPromo = oreDa(adesso, quando.promo)
  if (dallaPromo >= 0 && dallaPromo < DURATA_HYPE) return PHASES['hype-promo']

  // Dalla fine dell'entusiasmo iniziale fino ai premi Champions si gioca:
  // è la Weekend League, e la sua durata la dicono i due appuntamenti.
  const duraWeekend = oreDa(quando.premiChampions, quando.promo) || 168
  if (dallaPromo >= DURATA_HYPE && dallaPromo < duraWeekend) return PHASES['weekend-league']

  if (adesso.hour >= 1 && adesso.hour < 8) return PHASES.notte
  return PHASES['mid-settimana']
}

/** I prossimi appuntamenti fissi, per il conto alla rovescia in pagina. */
export function upcomingEvents(now = new Date(), count = 4, calendario = CALENDARIO_PREDEFINITO) {
  const quando = normalizzaCalendario(calendario)
  const events = []
  for (const voce of APPUNTAMENTI) {
    const entry = { ...voce, ...quando[voce.chiave] }
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
