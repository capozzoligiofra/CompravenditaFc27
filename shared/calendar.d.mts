export type PhaseId =
  | 'crollo-premi'
  | 'pre-promo'
  | 'hype-promo'
  | 'weekend-league'
  | 'notte'
  | 'mid-settimana'

export interface Phase {
  id: PhaseId
  label: string
  /** Cosa conviene fare adesso, in una riga. */
  advice: string
  /** >0 spinge a comprare, <0 spinge a vendere. Scala indicativa −3…+3. */
  bias: number
}

export interface CalendarEvent {
  id: string
  label: string
  detail: string
  at: number
  effect: 'offerta' | 'domanda'
}

export function romeParts(date: Date): { weekday: number; hour: number; minute: number }
export function currentPhase(now?: Date): Phase
export function upcomingEvents(now?: Date, count?: number): CalendarEvent[]
