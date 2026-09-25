import type { CartaBase } from './catalog.d.mts'
import type { PricePoint } from './history.d.mts'

export interface Unione {
  /** L'identificativo che sparisce. */
  da: string
  /** L'identificativo che resta. */
  a: string
  nome: string
  voto: number
}

export interface Ambiguo {
  nome: string
  id: string
  candidati: { id: string; nome: string; voto: number; club: string }[]
}

export function trovaDoppioni(carte?: CartaBase[]): { unioni: Unione[]; ambigui: Ambiguo[] }
export function mappaUnioni(unioni?: Unione[]): Map<string, string>
export function unisciStorico(primo?: PricePoint[], secondo?: PricePoint[]): PricePoint[]
export function applicaUnioni<T>(data: T, unioni?: Unione[]): { data: T; unite: number }
