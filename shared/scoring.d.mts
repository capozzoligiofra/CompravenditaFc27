import type { Catalyst, CatalystPlayerLike } from './catalysts.d.mts'
import type { Phase } from './calendar.d.mts'

export type OpportunityAction = 'compra' | 'prepara' | 'osserva' | 'evita' | 'vendi' | 'tieni'

export interface ScoreReason {
  label: string
  weight: number
}

export interface ScoreQuote {
  price: number
  minPrice: number
  maxPrice: number
  changePercent: number
  updated: string
}

export interface ScoreInput {
  player: CatalystPlayerLike & { id: string; name: string; rating: number }
  quote: ScoreQuote | null
  history?: { t: number; price: number }[]
  catalysts?: Catalyst[]
  phase?: Phase
  settings?: { taxPercent?: number; targetMarginPercent?: number; budget?: number }
  position?: { buyPrice: number; quantity: number } | null
}

export interface Opportunity {
  player: ScoreInput['player']
  score: number
  action: OpportunityAction
  reasons: ScoreReason[]
  buyBelow: number
  sellAt: number
  expectedProfit: number
  confidence: 'bassa' | 'media' | 'alta'
  catalysts: Catalyst[]
  overBudget: boolean
}

export function priceSignals(
  price: number,
  history: { t: number; price: number }[],
  quote: ScoreQuote | null,
): {
  hasHistory: boolean
  weekAverage: number
  low: number
  high: number
  dip: number
  trend3: number
  position: number
}
export function scorePlayer(input: ScoreInput): Opportunity
export function rankOpportunities(inputs: ScoreInput[], limit?: number): Opportunity[]
