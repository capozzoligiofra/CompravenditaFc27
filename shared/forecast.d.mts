import type { Phase } from './calendar.d.mts'

export interface PricePoint {
  t: number
  price: number
}

export interface Stima {
  price: number
  confidenza: 'alta' | 'media' | 'bassa' | 'molto bassa' | 'nessuna'
  spiegazione: string
  basePrice: number
  baseAt: number
  giorniPassati: number
  imparato?: boolean
}

export interface Finestra {
  quando: number
  fase: Phase
  variazioneAttesa: number
}

export const FATTORI_BASE: Record<string, number>

export function profiloDaStorico(history?: PricePoint[]): {
  fattori: Record<string, number>
  imparato: boolean
  osservazioni: number
}
export function tendenzaGiornaliera(history?: PricePoint[]): number
export function stimaPrezzo(input?: {
  history?: PricePoint[]
  quote?: { price: number; at?: number } | null
  now?: number
}): Stima
export function finestre(input?: { history?: PricePoint[]; now?: number; giorni?: number }): {
  adesso: { fase: Phase; fattore: number }
  acquisto: Finestra | null
  vendita: Finestra | null
}
