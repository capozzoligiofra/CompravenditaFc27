export interface ManualEntry {
  price: number
  at: number
}

export interface MergedQuote {
  price: number
  minPrice: number
  maxPrice: number
  changePercent: number
  updated: string
  manual?: boolean
}

export function manualQuote(price: number, at?: number): MergedQuote
export function mergeQuotes(
  quotes?: Record<string, MergedQuote | null>,
  manual?: Record<string, ManualEntry>,
  source?: string,
): Record<string, MergedQuote | null>
