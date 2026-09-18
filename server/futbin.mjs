// Client Futbin.
//
// Futbin non pubblica un'API ufficiale: quelli usati qui sono gli endpoint
// interni che il sito chiama dal browser. Possono cambiare senza preavviso,
// quindi ogni URL è sovrascrivibile da variabile d'ambiente e ogni risposta
// viene letta in modo difensivo. Se qualcosa non torna, il server ricade sul
// dataset demo invece di rompersi.

import { parseCoins, parsePercent, RateLimiter, TtlCache } from './util.mjs'

// L'anno del gioco compare negli indirizzi di Futbin (/26/, /27/…) e cambia
// ogni settembre. Invece di darlo per scontato si parte dal valore
// configurato e, se quello non risponde, si provano gli anni vicini fino a
// trovare quello vivo: così l'app continua a funzionare quando esce il
// gioco nuovo, senza che nessuno debba aggiornarla.
const CONFIGURED_YEAR = String(process.env.FUT_YEAR ?? process.env.FC27_YEAR ?? '26')
const YEAR_CANDIDATES = [...new Set([CONFIGURED_YEAR, '26', '27', '25'])]
let activeYear = CONFIGURED_YEAR

const BASE = (process.env.FUTBIN_BASE ?? 'https://www.futbin.com').replace(/\/$/, '')
const SEARCH_URL = process.env.FUTBIN_SEARCH_URL ?? `${BASE}/search`
const pricesUrl = (year) => process.env.FUTBIN_PRICES_URL ?? `${BASE}/${year}/playerPrices`
const graphUrl = (year) => process.env.FUTBIN_GRAPH_URL ?? `${BASE}/${year}/playerGraph`
const TIMEOUT_MS = Number(process.env.FUTBIN_TIMEOUT_MS ?? 9000)
const ENABLED = (process.env.FUTBIN_ENABLED ?? 'true') !== 'false'

const limiter = new RateLimiter(Number(process.env.FUTBIN_MIN_INTERVAL_MS ?? 1200))
const cache = new TtlCache()

export const TTL = {
  search: Number(process.env.FUTBIN_TTL_SEARCH_MS ?? 10 * 60 * 1000),
  prices: Number(process.env.FUTBIN_TTL_PRICES_MS ?? 90 * 1000),
  graph: Number(process.env.FUTBIN_TTL_GRAPH_MS ?? 30 * 60 * 1000),
}

export const futbinConfig = {
  enabled: ENABLED,
  base: BASE,
  configuredYear: CONFIGURED_YEAR,
  /** Anno effettivamente in uso: può differire da quello configurato. */
  get year() {
    return activeYear
  },
}

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

/**
 * Cerca prima con l'anno in uso; se non trova nulla prova gli altri anni e,
 * quando uno risponde, lo adotta anche per prezzi e grafici.
 */
export async function searchPlayers(query) {
  const term = String(query ?? '').trim()
  if (term.length < 2) return []
  return cached(`search:${activeYear}:${term.toLowerCase()}`, TTL.search, async () => {
    const ordine = [activeYear, ...YEAR_CANDIDATES.filter((year) => year !== activeYear)]
    let ultimoErrore = null
    for (const year of ordine) {
      try {
        const payload = await fetchJson(SEARCH_URL, { year, term })
        const players = toArray(payload).map(normalizePlayer).filter(Boolean)
        if (players.length > 0) {
          if (year !== activeYear) {
            console.log(`[fc27-trader] Futbin risponde per l'anno FC${year}: passo a quello.`)
            activeYear = year
          }
          return players.slice(0, 25)
        }
      } catch (error) {
        ultimoErrore = error
      }
    }
    if (ultimoErrore) throw ultimoErrore
    return []
  })
}

export async function fetchPrices(playerId) {
  const id = String(playerId)
  const payload = await cached(`prices:${activeYear}:${id}`, TTL.prices, () =>
    fetchJson(pricesUrl(activeYear), { player: id }),
  )
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
  const payload = await cached(`graph:${activeYear}:${id}:${plat}`, TTL.graph, () =>
    fetchJson(graphUrl(activeYear), { type: 'daily_graph', year: activeYear, player: id }),
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
