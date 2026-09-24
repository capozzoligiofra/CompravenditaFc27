export type StatoPrezzo = 'mai' | 'vecchio' | 'oggi'
export type GruppoPrezzo = 'tutte' | 'rosa' | 'watchlist' | 'da-aggiornare'

export interface VocePrezzo {
  id: string
  name: string
  rating: number
  ruolo: string
  club: string
  versione: string
  gruppi: string[]
  quantita: number
  prezzo: number
  osservatoIl: number
  scrittoAMano: boolean
  punti: number
  stato: StatoPrezzo
}

export const ORE_FRESCHEZZA: number

export function statoPrezzo(osservatoIl: number, now?: number): StatoPrezzo

export function vociPrezzo(input?: {
  seen?: { id: string; name: string; rating?: number; position?: string; club?: string; version?: string }[]
  watchlist?: { id: string; name: string; rating?: number }[]
  positions?: { playerId: string; name: string; rating?: number; quantity?: number; sellPrice?: number | null }[]
  condivise?: Record<string, { name: string; rating?: number }>
  manualPrices?: Record<string, { price: number; at: number }>
  priceHistory?: Record<string, { t: number; price: number }[]>
  now?: number
}): VocePrezzo[]

export function ordinaVoci(voci: VocePrezzo[], chiave?: (voce: VocePrezzo) => number): VocePrezzo[]
export function filtraVoci(
  voci: VocePrezzo[],
  filtro?: { gruppo?: GruppoPrezzo; testo?: string; tieni?: string[] },
): VocePrezzo[]
export function riepilogo(voci: VocePrezzo[]): { totale: number; aggiornate: number; daAggiornare: number; mai: number }
