export interface PrezzoCondiviso {
  price: number
  at: number
  autore?: string
}

export function prezziEffettivi(
  locali?: Record<string, { price: number; at: number }>,
  condivisi?: Record<string, PrezzoCondiviso>,
): Record<string, PrezzoCondiviso>

export function daInviare(
  locali?: Record<string, { price: number; at: number }>,
  condivisi?: Record<string, PrezzoCondiviso>,
): { id: string; price: number; at: number }[]

export function applicaRemoti(
  condivisi?: Record<string, PrezzoCondiviso>,
  remoti?: { id: string; price: number; at: number; autore?: string }[],
): { condivisi: Record<string, PrezzoCondiviso>; cambiato: boolean }

export function localiSuperati(
  locali?: Record<string, { price: number; at: number }>,
  condivisi?: Record<string, PrezzoCondiviso>,
): string[]

export function datiVuoti(dati: unknown): boolean

export function scegliDati(input?: {
  locale?: { watchlist?: unknown[]; positions?: unknown[]; seen?: unknown[] } | null
  localeAggiornatoAl?: number
  remoto?: { watchlist?: unknown[]; positions?: unknown[]; seen?: unknown[] } | null
  remotoAggiornatoAl?: number
}): 'invia' | 'applica' | 'niente'
