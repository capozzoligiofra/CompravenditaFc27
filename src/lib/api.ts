import type { DataSource, Platform, Player, PlayerDetail, Quote } from '../types.ts'

const BASE = import.meta.env.VITE_API_BASE ?? '/api'

export class ApiError extends Error {}

async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${BASE}${path}`, { signal })
  } catch {
    throw new ApiError('Proxy dati non raggiungibile: avvia "npm run dev" (o "npm run server").')
  }
  if (!response.ok) throw new ApiError(`Il proxy ha risposto ${response.status}`)
  const payload = (await response.json()) as T
  // Il service worker marca ciò che arriva dalla cache: significa telefono
  // offline e prezzi non aggiornati.
  if (response.headers.get('x-fc27-from-cache') === '1' && payload && typeof payload === 'object') {
    return { ...payload, fromCache: true }
  }
  return payload
}

export interface HealthResponse {
  ok: boolean
  futbin: { enabled: boolean; year: string; base: string; reachable: boolean | null }
  lastError: string | null
  lastErrorAt: string | null
  retryInSeconds: number
  demoPlayers: number
  fromCache?: boolean
}

export function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return request<HealthResponse>('/health', signal)
}

export interface SearchResponse {
  source: DataSource
  reason: string | null
  players: Player[]
  fromCache?: boolean
}

export function searchPlayers(query: string, signal?: AbortSignal): Promise<SearchResponse> {
  return request<SearchResponse>(`/search?q=${encodeURIComponent(query)}`, signal)
}

export function getPlayer(id: string, platform: Platform, signal?: AbortSignal): Promise<PlayerDetail> {
  return request<PlayerDetail>(`/player/${encodeURIComponent(id)}?platform=${platform}`, signal)
}

export interface QuotesResponse {
  source: DataSource
  platform: Platform
  quotes: Record<string, Quote | null>
  fromCache?: boolean
}

export function getQuotes(ids: string[], platform: Platform, signal?: AbortSignal): Promise<QuotesResponse> {
  if (ids.length === 0) {
    return Promise.resolve({ source: 'demo', platform, quotes: {} })
  }
  return request<QuotesResponse>(`/quotes?ids=${ids.map(encodeURIComponent).join(',')}&platform=${platform}`, signal)
}
