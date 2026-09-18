import type { Catalyst } from '../shared/catalysts.d.mts'

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
  /** Vero quando il prezzo l'hai scritto tu, non la sorgente automatica. */
  manual?: boolean
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
  fromCache?: boolean
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
  /** Avvisi del browser, chiesti esplicitamente dall'utente. */
  notifications: boolean
}

export type AlertSeverity = 'urgente' | 'buona' | 'info'

export interface Alert {
  id: string
  kind: 'compra' | 'vendi' | 'occasione' | 'finestra' | 'catalizzatore'
  title: string
  body: string
  severity: AlertSeverity
  at: number
  read: boolean
  playerId: string | null
}

export interface AppData {
  settings: Settings
  watchlist: WatchItem[]
  positions: Position[]
  /** Catalizzatori aggiunti a mano: quello che vedi in gioco e Futbin non dice. */
  catalysts: Catalyst[]
  alerts: Alert[]
  /** Giocatori già incontrati: è la base su cui l'app cerca le occasioni. */
  seen: Player[]
  /** Prezzi scritti a mano, quando la sorgente automatica non è disponibile. */
  manualPrices: Record<string, { price: number; at: number }>
}
