import type { CalendarEvent, Phase } from './calendar.d.mts'
import type { Opportunity, ScoreQuote } from './scoring.d.mts'

export interface AlertLike {
  id: string
  kind: 'compra' | 'vendi' | 'occasione' | 'finestra' | 'catalizzatore'
  title: string
  body: string
  severity: 'urgente' | 'buona' | 'info'
  at: number
  read: boolean
  playerId: string | null
}

export interface AlertContext {
  now?: number
  quotes?: Record<string, ScoreQuote | null>
  watchlist?: { id: string; name: string; buyTarget: number; sellTarget: number }[]
  positions?: {
    id: string
    playerId: string
    name: string
    quantity: number
    buyPrice: number
    sellPrice: number | null
  }[]
  opportunities?: Opportunity[]
  phase?: Phase | null
  events?: CalendarEvent[]
  settings?: { taxPercent?: number; targetMarginPercent?: number }
}

export function buildAlerts(context: AlertContext): AlertLike[]
