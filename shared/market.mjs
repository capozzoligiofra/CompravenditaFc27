// Matematica del mercato FUT: la tassa EA del 5% sulle vendite è il motivo
// per cui "comprato a 10.000, venduto a 10.000" è una perdita secca.

export const DEFAULT_TAX_PERCENT = 5

export function netFromSale(sellPrice, taxPercent = DEFAULT_TAX_PERCENT) {
  return sellPrice * (1 - taxPercent / 100)
}

export function profit(buyPrice, sellPrice, taxPercent = DEFAULT_TAX_PERCENT) {
  return netFromSale(sellPrice, taxPercent) - buyPrice
}

export function taxAmount(sellPrice, taxPercent = DEFAULT_TAX_PERCENT) {
  return sellPrice * (taxPercent / 100)
}

/** Prezzo di vendita minimo per non perderci: sotto questo si va in rosso. */
export function breakEvenSell(buyPrice, taxPercent = DEFAULT_TAX_PERCENT) {
  const factor = 1 - taxPercent / 100
  return factor > 0 ? buyPrice / factor : 0
}

export function roiPercent(buyPrice, sellPrice, taxPercent = DEFAULT_TAX_PERCENT) {
  if (buyPrice <= 0) return 0
  return (profit(buyPrice, sellPrice, taxPercent) / buyPrice) * 100
}

/**
 * Prezzo massimo di acquisto per ottenere il margine voluto rivendendo a
 * `sellPrice`. È il numero da mettere nel filtro "BIN massimo" quando si
 * fa sniping.
 */
export function maxBuyForMargin(
  sellPrice,
  marginPercent,
  taxPercent = DEFAULT_TAX_PERCENT,
) {
  const net = netFromSale(sellPrice, taxPercent)
  const divisor = 1 + marginPercent / 100
  return divisor > 0 ? Math.floor(net / divisor) : 0
}

/** Prezzo di acquisto massimo per portare a casa almeno `wantedProfit` crediti. */
export function maxBuyForProfit(
  sellPrice,
  wantedProfit,
  taxPercent = DEFAULT_TAX_PERCENT,
) {
  return Math.max(0, Math.floor(netFromSale(sellPrice, taxPercent) - wantedProfit))
}

/** Prezzo di vendita necessario per un margine voluto sull'acquisto fatto. */
export function sellForMargin(
  buyPrice,
  marginPercent,
  taxPercent = DEFAULT_TAX_PERCENT,
) {
  const factor = 1 - taxPercent / 100
  return factor > 0 ? Math.ceil((buyPrice * (1 + marginPercent / 100)) / factor) : 0
}

/**
 * Il mercato FUT accetta solo certi scalini di prezzo: arrotondiamo sempre
 * per difetto sull'acquisto, così il valore è davvero inseribile in gioco.
 */
export function roundToMarketStep(value) {
  if (value < 1_000) return Math.floor(value / 50) * 50
  if (value < 10_000) return Math.floor(value / 100) * 100
  if (value < 50_000) return Math.floor(value / 250) * 250
  if (value < 100_000) return Math.floor(value / 500) * 500
  return Math.floor(value / 1_000) * 1_000
}

export function signalFor(price, buyTarget, sellTarget) {
  if (!price) return 'nessun-target'
  if (buyTarget > 0 && price <= buyTarget) return 'compra'
  if (sellTarget > 0 && price >= sellTarget) return 'vendi'
  if (buyTarget > 0 || sellTarget > 0) return 'attendi'
  return 'nessun-target'
}
