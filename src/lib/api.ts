import type { Catalyst } from '../../shared/catalysts.d.mts'
import type { DataSource, Platform, Player, PlayerDetail, Quote } from '../types.ts'
import { getApiBase } from './apiBase.ts'

export class ApiError extends Error {}

export const SENZA_SORGENTE =
  'Nessuna sorgente automatica: i prezzi sono quelli che scrivete voi.'

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

/**
 * Prova il proxy; se non c'è, risponde con il vuoto dichiarato.
 *
 * Qui non si inventa niente: l'app non ha più un dataset finto da mostrare al
 * posto dei dati veri. Senza sorgente restano i prezzi che avete scritto voi,
 * e l'interfaccia lo dice invece di far finta che siano quotazioni.
 */
async function senzaProxy<T>(load: () => Promise<T>, vuoto: () => T, signal?: AbortSignal): Promise<T> {
  if (proxyLikelyDown()) return vuoto()
  try {
    const result = await load()
    proxyFailedAt = 0
    return result
  } catch (error) {
    if (signal?.aborted) throw error
    if (error instanceof ApiError) {
      proxyFailedAt = Date.now()
      return vuoto()
    }
    throw error
  }
}

export interface HealthResponse {
  ok: boolean
  mode: 'proxy' | 'statico'
  futbin: {
    /** Sorgente in uso: 'futbin' oppure 'api'. */
    name?: string
    /** Etichetta leggibile della sorgente, per esempio il sito dell'API. */
    label?: string
    enabled: boolean
    year: string
    configuredYear?: string
    base: string
    hasHistory?: boolean
    reachable: boolean | null
  }
  lastError: string | null
  lastErrorAt: string | null
  retryInSeconds: number
  fromCache?: boolean
}

function saluteStatica(): HealthResponse {
  return {
    ok: true,
    mode: 'statico',
    futbin: { name: 'nessuna', enabled: false, year: '', base: '', reachable: false },
    lastError: SENZA_SORGENTE,
    lastErrorAt: null,
    retryInSeconds: 0,
  }
}

export function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return senzaProxy(
    async () => ({ ...(await request<HealthResponse>('/health', signal)), mode: 'proxy' as const }),
    saluteStatica,
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
  return senzaProxy(
    () => request<SearchResponse>(`/search?q=${encodeURIComponent(query)}`, signal),
    () => ({ source: 'locale', reason: SENZA_SORGENTE, players: [] }),
    signal,
  )
}

export function getPlayer(id: string, platform: Platform, signal?: AbortSignal): Promise<PlayerDetail> {
  return senzaProxy(
    () => request<PlayerDetail>(`/player/${encodeURIComponent(id)}?platform=${platform}`, signal),
    () => ({ source: 'locale', reason: SENZA_SORGENTE, player: null, prices: {}, history: [] }),
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
    return Promise.resolve({ source: 'locale', platform, quotes: {} })
  }
  return senzaProxy(
    () => request<QuotesResponse>(`/quotes?ids=${ids.map(encodeURIComponent).join(',')}&platform=${platform}`, signal),
    () => ({ source: 'locale' as DataSource, platform, quotes: {} }),
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
  return senzaProxy(
    () => request<CatalystsResponse>('/catalysts', signal),
    () => ({ source: 'locale' as DataSource, reason: SENZA_SORGENTE, catalysts: [] }),
    signal,
  )
}

/**
 * Manda al proxy un prezzo scritto a mano, così finisce nell'archivio e vale
 * anche sugli altri dispositivi. Senza proxy (versione statica) fallisce in
 * silenzio: il prezzo resta comunque salvato in locale e nel listino condiviso.
 */
export async function sendManualPrice(
  id: string,
  platform: Platform,
  price: number,
  player?: Player | null,
): Promise<void> {
  if (!id || !(price > 0) || proxyLikelyDown()) return
  try {
    await fetch(`${getApiBase()}/prezzo`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, platform, price, player: player ?? undefined }),
    })
  } catch {
    // Nessun proxy: pazienza, il prezzo resta nel telefono.
  }
}

/** Dice al proxy quali carte seguire, per tenerle aggiornate in archivio. */
export async function declareInterest(ids: string[]): Promise<void> {
  if (ids.length === 0 || proxyLikelyDown()) return
  try {
    await fetch(`${getApiBase()}/interesse`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
  } catch {
    // Vale lo stesso discorso: è un di più, non un requisito.
  }
}
