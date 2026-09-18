import type { Catalyst } from '../../shared/catalysts.d.mts'
import { demoHistory, demoPlayer, demoPrices, demoRoster, demoSearch } from '../../shared/demo.mjs'
import type { DataSource, HistoryPoint, Platform, Player, PlayerDetail, Quote } from '../types.ts'
import { getApiBase } from './apiBase.ts'

export class ApiError extends Error {}

export const STATIC_REASON =
  'Nessun proxy dati raggiungibile: in uso il dataset demo incluso nell’app.'

// Quando il proxy non risponde smettiamo di interrogarlo per un minuto: sulla
// versione statica (GitHub Pages) non esiste proprio, e senza questa pausa
// ogni schermata pagherebbe una richiesta fallita prima di mostrare i dati.
const RETRY_AFTER_MS = 60_000
let proxyFailedAt = 0

function proxyLikelyDown(): boolean {
  return proxyFailedAt > 0 && Date.now() - proxyFailedAt < RETRY_AFTER_MS
}

export function isStaticMode(): boolean {
  return proxyLikelyDown()
}

async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${getApiBase()}${path}`, { signal })
  } catch {
    throw new ApiError('Proxy dati non raggiungibile.')
  }
  if (!response.ok) throw new ApiError(`Il proxy ha risposto ${response.status}`)

  let payload: T
  try {
    payload = (await response.json()) as T
  } catch {
    // Su un hosting statico /api non esiste e la risposta è la pagina HTML.
    throw new ApiError('Risposta non valida: a questo indirizzo non c’è un proxy dati.')
  }

  // Il service worker marca ciò che arriva dalla cache: significa telefono
  // offline e prezzi non aggiornati.
  if (response.headers.get('x-fc27-from-cache') === '1' && payload && typeof payload === 'object') {
    return { ...payload, fromCache: true }
  }
  return payload
}

/** Prova il proxy; se non c'è, risponde con i dati demo che l'app si porta dietro. */
async function withLocalFallback<T>(load: () => Promise<T>, local: () => T, signal?: AbortSignal): Promise<T> {
  if (proxyLikelyDown()) return local()
  try {
    const result = await load()
    proxyFailedAt = 0
    return result
  } catch (error) {
    if (signal?.aborted) throw error
    if (error instanceof ApiError) {
      proxyFailedAt = Date.now()
      return local()
    }
    throw error
  }
}

export interface HealthResponse {
  ok: boolean
  mode: 'proxy' | 'statico'
  futbin: { enabled: boolean; year: string; base: string; reachable: boolean | null }
  lastError: string | null
  lastErrorAt: string | null
  retryInSeconds: number
  demoPlayers: number
  fromCache?: boolean
}

function staticHealth(): HealthResponse {
  return {
    ok: true,
    mode: 'statico',
    futbin: { enabled: false, year: '27', base: '', reachable: false },
    lastError: STATIC_REASON,
    lastErrorAt: null,
    retryInSeconds: 0,
    demoPlayers: demoRoster().length,
  }
}

export function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return withLocalFallback(
    async () => ({ ...(await request<HealthResponse>('/health', signal)), mode: 'proxy' as const }),
    staticHealth,
    signal,
  )
}

export interface SearchResponse {
  source: DataSource
  reason: string | null
  players: Player[]
  fromCache?: boolean
}

export function searchPlayers(query: string, signal?: AbortSignal): Promise<SearchResponse> {
  return withLocalFallback(
    () => request<SearchResponse>(`/search?q=${encodeURIComponent(query)}`, signal),
    () => ({ source: 'demo', reason: STATIC_REASON, players: demoSearch(query) as Player[] }),
    signal,
  )
}

export function getPlayer(id: string, platform: Platform, signal?: AbortSignal): Promise<PlayerDetail> {
  return withLocalFallback(
    () => request<PlayerDetail>(`/player/${encodeURIComponent(id)}?platform=${platform}`, signal),
    () => ({
      source: 'demo',
      reason: STATIC_REASON,
      player: demoPlayer(id) as Player | null,
      prices: (demoPrices(id) ?? {}) as Partial<Record<Platform, Quote>>,
      history: demoHistory(id, platform) as HistoryPoint[],
    }),
    signal,
  )
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
  return withLocalFallback(
    () => request<QuotesResponse>(`/quotes?ids=${ids.map(encodeURIComponent).join(',')}&platform=${platform}`, signal),
    () => ({
      source: 'demo' as DataSource,
      platform,
      quotes: Object.fromEntries(ids.map((id) => [id, (demoPrices(id)?.[platform] as Quote | undefined) ?? null])),
    }),
    signal,
  )
}

export interface CatalystsResponse {
  source: DataSource
  reason: string | null
  catalysts: Catalyst[]
  fromCache?: boolean
}

/**
 * SBC e obiettivi in corso letti da Futbin. Senza proxy (versione statica)
 * l'elenco è vuoto: restano il calendario e i catalizzatori inseriti a mano.
 */
export function getCatalysts(signal?: AbortSignal): Promise<CatalystsResponse> {
  return withLocalFallback(
    () => request<CatalystsResponse>('/catalysts', signal),
    () => ({ source: 'demo' as DataSource, reason: STATIC_REASON, catalysts: [] }),
    signal,
  )
}
