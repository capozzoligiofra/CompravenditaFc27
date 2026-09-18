export type Signal = 'compra' | 'vendi' | 'attendi' | 'nessun-target'

export const DEFAULT_TAX_PERCENT: number

export function netFromSale(sellPrice: number, taxPercent?: number): number
export function profit(buyPrice: number, sellPrice: number, taxPercent?: number): number
export function taxAmount(sellPrice: number, taxPercent?: number): number
export function breakEvenSell(buyPrice: number, taxPercent?: number): number
export function roiPercent(buyPrice: number, sellPrice: number, taxPercent?: number): number
export function maxBuyForMargin(sellPrice: number, marginPercent: number, taxPercent?: number): number
export function maxBuyForProfit(sellPrice: number, wantedProfit: number, taxPercent?: number): number
export function sellForMargin(buyPrice: number, marginPercent: number, taxPercent?: number): number
export function roundToMarketStep(value: number): number
export function signalFor(price: number, buyTarget: number, sellTarget: number): Signal
