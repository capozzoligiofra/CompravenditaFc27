// Client Futbin.
//
// Futbin non pubblica un'API ufficiale: quelli usati qui sono gli endpoint
// interni che il sito chiama dal browser. Possono cambiare senza preavviso,
// quindi ogni URL è sovrascrivibile da variabile d'ambiente e ogni risposta
// viene letta in modo difensivo. Se qualcosa non torna, il server ricade sul
// dataset demo invece di rompersi.

import { parseCoins, parsePercent, RateLimiter, TtlCache } from './util.mjs'

const GAME_YEAR = process.env.FC27_YEAR ?? '27'
const BASE = (process.env.FUTBIN_BASE ?? 'https://www.futbin.com').replace(/\/$/, '')
const SEARCH_URL = process.env.FUTBIN_SEARCH_URL ?? `${BASE}/search`
const PRICES_URL = process.env.FUTBIN_PRICES_URL ?? `${BASE}/${GAME_YEAR}/playerPrices`
const GRAPH_URL = process.env.FUTBIN_GRAPH_URL ?? `${BASE}/${GAME_YEAR}/playerGraph`
const TIMEOUT_MS = Number(process.env.FUTBIN_TIMEOUT_MS ?? 9000)
const ENABLED = (process.env.FUTBIN_ENABLED ?? 'true') !== 'false'

const limiter = new RateLimiter(Number(process.env.FUTBIN_MIN_INTERVAL_MS ?? 1200))
const cache = new TtlCache()

export const TTL = {
  search: Number(process.env.FUTBIN_TTL_SEARCH_MS ?? 10 * 60 * 1000),
  prices: Number(process.env.FUTBIN_TTL_PRICES_MS ?? 90 * 1000),
  graph: Number(process.env.FUTBIN_TTL_GRAPH_MS ?? 30 * 60 * 1000),
}

export const futbinConfig = { enabled: ENABLED, year: GAME_YEAR, base: BASE }

export const PLATFORMS = ['ps', 'xbox', 'pc']

function normalizePlatform(platform) {
  const value = String(platform ?? '').toLowerCase()
  if (value === 'xbox' || value === 'xb') return 'xbox'
  if (value === 'pc' || value === 'origin') return 'pc'
  return 'ps'
}

async function fetchJson(url, params) {
  const target = new URL(url)
  for (const [key, value] of Object.entries(params ?? {})) {
    target.searchParams.set(key, String(value))
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(target, {
      signal: controller.signal,
      headers: {
        accept: 'application/json, text/javascript, */*; q=0.01',
        'accept-language': 'it-IT,it;q=0.9,en;q=0.8',
        'x-requested-with': 'XMLHttpRequest',
        referer: `${BASE}/`,
        'user-agent': process.env.FUTBIN_USER_AGENT ?? 'fc27-trader/0.1 (uso personale)',
      },
    })
    if (!response.ok) throw new Error(`Futbin ha risposto ${response.status}`)
    const text = await response.text()
    try {
      return JSON.parse(text)
    } catch {
      throw new Error('Risposta di Futbin non in formato JSON (endpoint cambiato o richiesta bloccata)')
    }
  } finally {
    clearTimeout(timer)
  }
}

function cached(key, ttl, loader) {
  const hit = cache.get(key)
  if (hit !== undefined) return Promise.resolve(hit)
  return limiter.run(loader).then((value) => {
    cache.set(key, value, ttl)
    return value
  })
}

function pick(source, keys, fallback = '') {
  for (const key of keys) {
    const value = source?.[key]
    if (value !== undefined && value !== null && String(value).trim() !== '') return value
  }
  return fallback
}

function normalizePlayer(raw) {
  const id = String(pick(raw, ['id', 'player_id', 'resource_id', 'baseId'], ''))
  if (!id) return null
  return {
    id,
    name: String(pick(raw, ['full_name', 'player_name', 'name', 'common_name'], 'Sconosciuto')),
    rating: Number(parseCoins(pick(raw, ['rating', 'ratingSquare', 'player_rating'], 0))) || 0,
    position: String(pick(raw, ['position', 'playerPosition'], '—')),
    club: String(pick(raw, ['club', 'club_name'], '—')),
    league: String(pick(raw, ['league', 'league_name'], '—')),
    nation: String(pick(raw, ['nation', 'nation_name'], '—')),
    version: String(pick(raw, ['rare_type', 'revision', 'version', 'card_type'], 'Base')),
    image: String(pick(raw, ['image', 'playerimage', 'player_image'], '')),
  }
}

/** Le risposte di Futbin a volte sono un array, a volte un oggetto indicizzato. */
function toArray(payload) {
  if (Array.isArray(payload)) return payload
  if (payload && typeof payload === 'object') {
    if (Array.isArray(payload.data)) return payload.data
    if (Array.isArray(payload.players)) return payload.players
    return Object.values(payload).filter((item) => item && typeof item === 'object')
  }
  return []
}

export async function searchPlayers(query) {
  const term = String(query ?? '').trim()
  if (term.length < 2) return []
  const payload = await cached(`search:${term.toLowerCase()}`, TTL.search, () =>
    fetchJson(SEARCH_URL, { year: GAME_YEAR, term }),
  )
  return toArray(payload).map(normalizePlayer).filter(Boolean).slice(0, 25)
}

export async function fetchPrices(playerId) {
  const id = String(playerId)
  const payload = await cached(`prices:${id}`, TTL.prices, () => fetchJson(PRICES_URL, { player: id }))
  const node = payload?.[id]?.prices ?? payload?.prices ?? payload?.[id] ?? payload
  const result = {}
  for (const platform of PLATFORMS) {
    const entry = node?.[platform] ?? node?.[platform === 'ps' ? 'ps4' : platform] ?? {}
    result[platform] = {
      price: parseCoins(pick(entry, ['LCPrice', 'lowest_bin', 'price'], 0)),
      minPrice: parseCoins(pick(entry, ['MinPrice', 'min_price'], 0)),
      maxPrice: parseCoins(pick(entry, ['MaxPrice', 'max_price'], 0)),
      changePercent: parsePercent(pick(entry, ['PRP', 'prp'], 0)),
      updated: String(pick(entry, ['updated', 'last_updated'], 'sconosciuto')),
    }
  }
  return result
}

/**
 * Il grafico arriva come serie di coppie [timestamp, prezzo] annidate a
 * profondità variabile: le cerchiamo ricorsivamente invece di fidarci
 * di una forma fissa.
 */
function findSeries(node, depth = 0) {
  if (depth > 6 || !node) return null
  if (Array.isArray(node)) {
    const pairs = node.filter((item) => Array.isArray(item) && item.length >= 2)
    if (pairs.length >= 2) return pairs
    return null
  }
  if (typeof node === 'object') {
    for (const value of Object.values(node)) {
      const found = findSeries(value, depth + 1)
      if (found) return found
    }
  }
  return null
}

export async function fetchGraph(playerId, platform) {
  const id = String(playerId)
  const plat = normalizePlatform(platform)
  const payload = await cached(`graph:${id}:${plat}`, TTL.graph, () =>
    fetchJson(GRAPH_URL, { type: 'daily_graph', year: GAME_YEAR, player: id }),
  )
  const platformNode = payload?.[plat] ?? payload?.[plat === 'ps' ? 'ps4' : plat] ?? payload
  const series = findSeries(platformNode) ?? []
  return series
    .map(([timestamp, price]) => ({ t: Number(timestamp), price: parseCoins(price) }))
    .filter((point) => Number.isFinite(point.t) && point.price > 0)
    .sort((a, b) => a.t - b.t)
    .slice(-90)
}

export { normalizePlatform }
