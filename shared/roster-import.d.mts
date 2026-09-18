export interface RosterLine {
  name: string
  quantity: number
  buyPrice: number
}

export const MAX_RIGHE_IMPORT: number

export function parseCoinsLoose(raw: unknown): number
export function parseRosterLine(line: string): RosterLine | null
export function parseRoster(text: string): RosterLine[]
export function pickBestMatch<T extends { name: string; rating?: number }>(name: string, players: T[]): T | null
