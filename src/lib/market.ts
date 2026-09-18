// Matematica del mercato FUT: la tassa EA del 5% sulle vendite è il motivo
// per cui "comprato a 10.000, venduto a 10.000" è una perdita secca.

export const DEFAULT_TAX_PERCENT = 5

export function netFromSale(sellPrice: number, taxPercent = DEFAULT_TAX_PERCENT): number {
  return sellPrice * (1 - taxPercent / 100)
}

export function profit(buyPrice: number, sellPrice: number, taxPercent = DEFAULT_TAX_PERCENT): number {
  return netFromSale(sellPrice, taxPercent) - buyPrice
}

export function taxAmount(sellPrice: number, taxPercent = DEFAULT_TAX_PERCENT): number {
  return sellPrice * (taxPercent / 100)
}

/** Prezzo di vendita minimo per non perderci: sotto questo si va in rosso. */
export function breakEvenSell(buyPrice: number, taxPercent = DEFAULT_TAX_PERCENT): number {
  const factor = 1 - taxPercent / 100
  return factor > 0 ? buyPrice / factor : 0
}

export function roiPercent(buyPrice: number, sellPrice: number, taxPercent = DEFAULT_TAX_PERCENT): number {
  if (buyPrice <= 0) return 0
  return (profit(buyPrice, sellPrice, taxPercent) / buyPrice) * 100
}

/**
 * Prezzo massimo di acquisto per ottenere il margine voluto rivendendo a
 * `sellPrice`. È il numero da mettere nel filtro "BIN massimo" quando si
 * fa sniping.
 */
export function maxBuyForMargin(
  sellPrice: number,
  marginPercent: number,
  taxPercent = DEFAULT_TAX_PERCENT,
): number {
  const net = netFromSale(sellPrice, taxPercent)
  const divisor = 1 + marginPercent / 100
  return divisor > 0 ? Math.floor(net / divisor) : 0
}

/** Prezzo di acquisto massimo per portare a casa almeno `wantedProfit` crediti. */
export function maxBuyForProfit(
  sellPrice: number,
  wantedProfit: number,
  taxPercent = DEFAULT_TAX_PERCENT,
): number {
  return Math.max(0, Math.floor(netFromSale(sellPrice, taxPercent) - wantedProfit))
}

/** Prezzo di vendita necessario per un margine voluto sull'acquisto fatto. */
export function sellForMargin(
  buyPrice: number,
  marginPercent: number,
  taxPercent = DEFAULT_TAX_PERCENT,
): number {
  const factor = 1 - taxPercent / 100
  return factor > 0 ? Math.ceil((buyPrice * (1 + marginPercent / 100)) / factor) : 0
}

/**
 * Il mercato FUT accetta solo certi scalini di prezzo: arrotondiamo sempre
 * per difetto sull'acquisto, così il valore è davvero inseribile in gioco.
 */
export function roundToMarketStep(value: number): number {
  if (value < 1_000) return Math.floor(value / 50) * 50
  if (value < 10_000) return Math.floor(value / 100) * 100
  if (value < 50_000) return Math.floor(value / 250) * 250
  if (value < 100_000) return Math.floor(value / 500) * 500
  return Math.floor(value / 1_000) * 1_000
}

export type Signal = 'compra' | 'vendi' | 'attendi' | 'nessun-target'

export function signalFor(price: number, buyTarget: number, sellTarget: number): Signal {
  if (!price) return 'nessun-target'
  if (buyTarget > 0 && price <= buyTarget) return 'compra'
  if (sellTarget > 0 && price >= sellTarget) return 'vendi'
  if (buyTarget > 0 || sellTarget > 0) return 'attendi'
  return 'nessun-target'
}
