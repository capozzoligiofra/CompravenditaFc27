import type { CartaBase, IndiceCarte } from './catalog.d.mts'

export interface RigaSorgente {
  nome: string
  voto: number
  price: number
  at: number
}

export function abbinaSorgente(
  righe?: RigaSorgente[],
  indice?: IndiceCarte,
): {
  prezzi: Record<string, { price: number; at: number }>
  carte: Record<string, { name: string; rating: number }>
  contesi: { nome: string; voti: number[] }[]
  sconosciuti: string[]
}

export type { CartaBase }
