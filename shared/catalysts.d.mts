export type CatalystKind = 'sbc' | 'obiettivo' | 'promo' | 'evento' | 'manuale'
export type CatalystSource = 'futbin' | 'manuale' | 'calendario'

export interface CatalystMatch {
  minRating: number | null
  maxRating: number | null
  leagues: string[]
  nations: string[]
  clubs: string[]
  positions: string[]
  players: string[]
}

export interface Catalyst {
  id: string
  kind: CatalystKind
  title: string
  detail: string
  source: CatalystSource
  startsAt: number | null
  endsAt: number | null
  impact: number
  match: CatalystMatch
}

export interface CatalystPlayerLike {
  name?: string
  rating?: number
  league?: string
  nation?: string
  club?: string
  position?: string
}

export const FODDER_MIN: number
export const FODDER_MAX: number

export function canonicalToken(value: string): string
export function normalizeCatalyst(raw: unknown): Catalyst
export function isActive(catalyst: Catalyst, now?: number): boolean
export function isImminent(catalyst: Catalyst, now?: number): boolean
export function matchesPlayer(catalyst: Catalyst, player: CatalystPlayerLike): boolean
export function matchingCatalysts(player: CatalystPlayerLike, catalysts: Catalyst[], now?: number): Catalyst[]
export function isFodder(player: CatalystPlayerLike): boolean
