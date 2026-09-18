export type Platform = 'ps' | 'xbox' | 'pc'

export type DataSource = 'futbin' | 'demo'

export interface Player {
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

export interface Quote {
  price: number
  minPrice: number
  maxPrice: number
  changePercent: number
  updated: string
}

export interface HistoryPoint {
  t: number
  price: number
}

export interface PlayerDetail {
  source: DataSource
  reason: string | null
  player: Player | null
  prices: Partial<Record<Platform, Quote>>
  history: HistoryPoint[]
}

export interface WatchItem {
  id: string
  name: string
  rating: number
  position: string
  club: string
  buyTarget: number
  sellTarget: number
  note: string
  addedAt: number
}

export interface Position {
  id: string
  playerId: string
  name: string
  rating: number
  quantity: number
  buyPrice: number
  buyAt: number
  sellPrice: number | null
  sellAt: number | null
  platform: Platform
  note: string
}

export interface Settings {
  platform: Platform
  taxPercent: number
  targetMarginPercent: number
  budget: number
}

export interface AppData {
  settings: Settings
  watchlist: WatchItem[]
  positions: Position[]
}
