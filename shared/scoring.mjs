// Motore delle occasioni: prende quello che si sa di una carta (prezzo,
// storico, catalizzatori attivi, momento della settimana) e ne ricava un
// punteggio con le ragioni in chiaro.
//
// Regola di fondo: si guadagna comprando quando il mercato è pieno di carte
// (premi, vigilia della promo, ore morte) e rivendendo quando la domanda
// torna (uscita promo, Weekend League) o quando una SBC chiede proprio
// quella carta. Il punteggio pesa questi segnali, non predice il futuro:
// ogni voce resta visibile all'utente, che decide.

import { matchingCatalysts, isFodder } from './catalysts.mjs'
import { maxBuyForMargin, profit, roundToMarketStep } from './market.mjs'

const MAX_UPLIFT = 0.25

function average(values) {
  if (values.length === 0) return 0
  return values.reduce((total, value) => total + value, 0) / values.length
}

/** Segnali ricavati dallo storico: dove sta il prezzo rispetto alla settimana. */
export function priceSignals(price, history, quote) {
  const prices = history.map((point) => point.price).filter((value) => value > 0)
  const week = prices.slice(-7)
  const weekAverage = average(week)
  const low = prices.length > 0 ? Math.min(...prices) : (quote?.minPrice ?? 0)
  const high = prices.length > 0 ? Math.max(...prices) : (quote?.maxPrice ?? 0)
  const threeDays = prices.slice(-3)

  return {
    hasHistory: prices.length >= 5,
    weekAverage,
    low,
    high,
    /** Quanto il prezzo sta sotto la media settimanale (0,12 = 12% sotto). */
    dip: weekAverage > 0 ? (weekAverage - price) / weekAverage : 0,
    /** Variazione negli ultimi tre giorni. */
    trend3: threeDays.length >= 2 && threeDays[0] > 0 ? (price - threeDays[0]) / threeDays[0] : 0,
    /** Posizione nel range storico: 0 = sul minimo, 1 = sul massimo. */
    position: high > low ? (price - low) / (high - low) : 0.5,
  }
}

/**
 * Punteggio 0-100 con le ragioni. `weight` serve solo a ordinare le voci in
 * pagina: il numero non va mostrato come se fosse una previsione.
 */
export function scorePlayer(input) {
  const { player, quote, history = [], catalysts = [], phase, settings, position = null } = input
  const price = quote?.price ?? 0
  const tax = settings?.taxPercent ?? 5
  const margin = settings?.targetMarginPercent ?? 15
  const reasons = []
  let score = 35
  let uplift = 0

  if (!price) {
    return {
      player,
      score: 0,
      action: 'evita',
      reasons: [{ label: 'Prezzo non disponibile per questa piattaforma', weight: 0 }],
      buyBelow: 0,
      sellAt: 0,
      expectedProfit: 0,
      confidence: 'bassa',
      catalysts: [],
      overBudget: false,
    }
  }

  const signals = priceSignals(price, history, quote)

  // 1. Prezzo sotto la media della settimana: il segnale più concreto.
  if (signals.hasHistory && signals.dip > 0.03) {
    const points = Math.min(25, Math.round(signals.dip * 140))
    score += points
    uplift += Math.min(0.12, signals.dip * 0.6)
    reasons.push({
      label: `Costa il ${Math.round(signals.dip * 100)}% meno della media di questa settimana`,
      weight: points,
    })
  } else if (signals.hasHistory && signals.dip < -0.08) {
    score -= 12
    reasons.push({ label: 'Già sopra la media settimanale: si compra caro', weight: -12 })
  }

  // 2. Vicino al minimo storico visto.
  if (signals.hasHistory && signals.position <= 0.15) {
    score += 12
    reasons.push({ label: 'Prezzo a ridosso del minimo delle ultime settimane', weight: 12 })
  } else if (signals.hasHistory && signals.position >= 0.9) {
    score -= 10
    reasons.push({ label: 'Prezzo sui massimi recenti: poco spazio per salire', weight: -10 })
  }

  // 3. Caduta rapida: buona se contenuta, sospetta se esagerata.
  if (signals.trend3 < -0.2) {
    score -= 8
    reasons.push({ label: 'In forte calo da giorni: rischio che continui a scendere', weight: -8 })
  } else if (signals.trend3 < -0.05) {
    score += 8
    uplift += 0.04
    reasons.push({ label: 'In calo negli ultimi giorni, senza crollare', weight: 8 })
  }

  // 4. Variazione sulle 24 ore dichiarata dalla fonte.
  const change = quote?.changePercent ?? 0
  if (change <= -5) {
    score += 8
    reasons.push({ label: `Sceso del ${Math.abs(Math.round(change))}% nelle ultime ore`, weight: 8 })
  } else if (change >= 10) {
    score -= 8
    reasons.push({ label: `Già salito del ${Math.round(change)}%: la corsa è partita senza di te`, weight: -8 })
  }

  // 5. Catalizzatori: SBC, obiettivi, promo che chiedono proprio questa carta.
  const active = matchingCatalysts(player, catalysts)
  for (const catalyst of active.slice(0, 3)) {
    const points = catalyst.impact * 9
    score += points
    uplift += catalyst.impact * 0.03
    reasons.push({ label: `${etichettaTipo(catalyst.kind)}: ${catalyst.title}`, weight: points })
  }

  // 6. Momento della settimana.
  if (phase) {
    const points = phase.bias * 3
    score += points
    uplift += Math.max(0, phase.bias) * 0.012
    reasons.push({ label: `${phase.label}: ${phase.advice}`, weight: points })
  }

  // 7. Fascia fodder: sempre richiesta dalle SBC.
  if (isFodder(player)) {
    score += 4
    reasons.push({ label: 'Valutazione nella fascia più richiesta dalle SBC (83-86)', weight: 4 })
  }

  const overBudget = Boolean(settings?.budget) && price > settings.budget
  if (overBudget) {
    reasons.push({ label: 'Costa più del budget che hai impostato', weight: 0 })
  }

  uplift = Math.min(MAX_UPLIFT, uplift)
  score = Math.max(0, Math.min(100, Math.round(score)))

  const sellAt = Math.round(price * (1 + uplift))
  const buyBelow = roundToMarketStep(maxBuyForMargin(sellAt, margin, tax))
  const expectedProfit = Math.round(profit(Math.min(buyBelow, price), sellAt, tax))

  return {
    player,
    score,
    action: decideAction({
      score,
      price,
      position,
      phase,
      tax,
      margin,
      hasEdge: signals.dip > 0.05 || active.length > 0 || change <= -5,
      hasHistory: signals.hasHistory,
    }),
    reasons: reasons.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight)),
    buyBelow,
    sellAt,
    expectedProfit,
    confidence: signals.hasHistory ? (active.length > 0 ? 'alta' : 'media') : 'bassa',
    catalysts: active,
    overBudget,
  }
}

function etichettaTipo(kind) {
  if (kind === 'sbc') return 'SBC attiva'
  if (kind === 'obiettivo') return 'Obiettivo'
  if (kind === 'promo') return 'Promo'
  if (kind === 'evento') return 'Evento'
  return 'Segnalato da te'
}

/**
 * Se la carta è già in magazzino la domanda diventa "vendere o tenere?".
 *
 * Per dire "compra ora" non basta un punteggio alto: serve un motivo
 * concreto (prezzo sotto la media, una SBC che la richiede, un calo nelle
 * ultime ore) e uno storico su cui basarsi. Senza, resta un "tieni pronto":
 * se ogni carta fosse un affare, il consiglio non varrebbe niente.
 */
function decideAction({ score, price, position, phase, tax, margin, hasEdge, hasHistory }) {
  if (position) {
    const gain = profit(position.buyPrice, price, tax)
    const gainPercent = position.buyPrice > 0 ? (gain / position.buyPrice) * 100 : 0
    if (gainPercent >= margin) return 'vendi'
    if (phase && phase.bias <= -2 && gainPercent > 0) return 'vendi'
    return 'tieni'
  }
  if (score >= 72 && hasEdge && hasHistory) return 'compra'
  if (score >= 60 && hasEdge) return 'prepara'
  if (score >= 52) return 'osserva'
  if (score < 35) return 'evita'
  return 'osserva'
}

/** Ordina i candidati e tiene solo quelli che vale la pena mostrare. */
export function rankOpportunities(inputs, limit = 12) {
  return inputs
    .map((input) => scorePlayer(input))
    .filter((opportunity) => opportunity.score > 0)
    .sort((a, b) => b.score - a.score || b.expectedProfit - a.expectedProfit)
    .slice(0, limit)
}
