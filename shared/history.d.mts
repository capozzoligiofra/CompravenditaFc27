export interface PricePoint {
  t: number
  price: number
}

export const MAX_PUNTI_STORICO: number

export function recordSnapshot(history: PricePoint[] | undefined, price: number, now?: number): PricePoint[]
export function needsSnapshot(history: PricePoint[] | undefined, price: number, now?: number): boolean
