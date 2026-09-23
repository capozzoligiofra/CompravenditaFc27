export interface ManualEntry {
  price: number
  at: number
  /** Chi l'ha segnato, se non sei tu (listino condiviso). */
  autore?: string
}

export interface MergedQuote {
  price: number
  minPrice: number
  maxPrice: number
  changePercent: number
  updated: string
  manual?: boolean
  autore?: string
}

export function isLiveSource(source: string | null | undefined): boolean
export function manualQuote(price: number, at?: number, autore?: string): MergedQuote
export function mergeQuotes(
  quotes?: Record<string, MergedQuote | null>,
  manual?: Record<string, ManualEntry>,
  source?: string,
): Record<string, MergedQuote | null>
