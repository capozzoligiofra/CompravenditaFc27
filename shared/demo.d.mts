// Tipi del dataset demo condiviso fra il proxy Node e l'app nel browser.

export interface DemoPlayer {
  id: string
  name: string
  rating: number
  position: string
  club: string
  league: string
  nation: string
  version: string
  image: string
}

export interface DemoQuote {
  price: number
  minPrice: number
  maxPrice: number
  changePercent: number
  updated: string
}

export interface DemoPoint {
  t: number
  price: number
}

export function demoHistory(playerId: string, platform: string, days?: number): DemoPoint[]
export function demoPrices(playerId: string): Record<string, DemoQuote> | null
export function demoSearch(query: string): DemoPlayer[]
export function demoPlayer(playerId: string): DemoPlayer | null
export function demoRoster(): DemoPlayer[]
