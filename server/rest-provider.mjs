// Sorgente dati generica: una qualsiasi API REST con chiave.
//
// Non è legata a un fornitore preciso di proposito. I servizi di dati FUT
// nascono, cambiano nome e chiudono, e indicarne uno nel codice significa
// spedire un indirizzo che un giorno non risponde più. Qui si configurano
// indirizzo, chiave, intestazione e percorsi; il codice si limita a leggere
// la risposta in modo difensivo, accettando nomi di campo diversi, prezzi
// scritti in mille modi ed elenchi annidati.
//
// Serve un servizio che consenta l'accesso programmatico: è il punto di
// tutta questa strada, visto che Futbin lo vieta.

import { describeFetchError, parseCoins, RateLimiter, TtlCache } from './util.mjs'

const BASE = (process.env.FUT_API_BASE ?? process.env.FUTDB_BASE ?? '').replace(/\/$/, '')
const KEY = process.env.FUT_API_KEY ?? process.env.FUTDB_KEY ?? ''
const KEY_HEADER = process.env.FUT_API_KEY_HEADER ?? 'X-AUTH-TOKEN'
const SEARCH_PATH = process.env.FUT_API_SEARCH_PATH ?? process.env.FUTDB_SEARCH_PATH ?? '/players/search'
const SEARCH_PARAM = process.env.FUT_API_SEARCH_PARAM ?? 'name'
const PRICE_PATH = process.env.FUT_API_PRICE_PATH ?? process.env.FUTDB_PRICE_PATH ?? '/players/{id}/price'
const TIMEOUT_MS = Number(process.env.FUT_API_TIMEOUT_MS ?? 9000)

const limiter = new RateLimiter(Number(process.env.FUT_API_MIN_INTERVAL_MS ?? 700))
const cache = new TtlCache()

const TTL = {
  search: Number(process.env.FUT_API_TTL_SEARCH_MS ?? 10 * 60 * 1000),
  prices: Number(process.env.FUT_API_TTL_PRICES_MS ?? 90 * 1000),
}

export const restConfig = {
  get enabled() {
    return Boolean(BASE && KEY)
  },
  base: BASE,
  keyHeader: KEY_HEADER,
  searchPath: SEARCH_PATH,
  pricePath: PRICE_PATH,
  name: 'api',
  /** Etichetta leggibile: il nome del sito configurato. */
  get label() {
    if (!BASE) return 'nessuna API configurata'
    try {
      return new URL(BASE).hostname
    } catch {
      return BASE
    }
  },
}

async function fetchJson(path, params) {
  if (!BASE) throw new Error("Manca l'indirizzo dell'API: imposta FUT_API_BASE")
  if (!KEY) throw new Error('Manca la chiave: impostala in FUT_API_KEY')
  const target = new URL(`${BASE}${path}`)
  for (const [key, value] of Object.entries(params ?? {})) target.searchParams.set(key, String(value))

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let response
  try {
    response = await fetch(target, {
      signal: controller.signal,
      headers: { accept: 'application/json', [KEY_HEADER]: KEY },
    })
  } catch (error) {
    clearTimeout(timer)
    throw new Error(describeFetchError(error))
  }
  try {
    if (response.status === 401 || response.status === 403) {
      throw new Error(`L'API rifiuta la chiave (HTTP ${response.status}): controlla FUT_API_KEY e FUT_API_KEY_HEADER`)
    }
    if (response.status === 429) throw new Error('Troppe richieste: aspetta qualche minuto')
    if (response.status === 404) throw new Error(`HTTP 404: il percorso ${path} non esiste su questa API`)
    if (!response.ok) throw new Error(`L'API ha risposto ${response.status}`)
    const text = await response.text()
    try {
      return JSON.parse(text)
    } catch {
      throw new Error('Risposta non in formato JSON: indirizzo giusto?')
    }
  } finally {
    clearTimeout(timer)
  }
}

/** Le API impacchettano gli elenchi in modi diversi: items, data, results… */
function toArray(payload) {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== 'object') return []
  for (const chiave of ['items', 'data', 'results', 'players']) {
    if (Array.isArray(payload[chiave])) return payload[chiave]
  }
  return []
}

function pick(source, keys, fallback = '') {
  for (const key of keys) {
    const value = source?.[key]
    if (value !== undefined && value !== null && String(value).trim() !== '') return value
  }
  return fallback
}

/** Club, lega e nazione a volte sono nomi, a volte identificativi numerici. */
function nomeOppureVuoto(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') return String(value.name ?? value.title ?? '')
  const testo = String(value).trim()
  return /^\d+$/.test(testo) ? '' : testo
}

function normalizePlayer(raw) {
  const id = String(pick(raw, ['id', 'playerId', 'resourceId'], ''))
  if (!id) return null
  return {
    id,
    name: String(pick(raw, ['commonName', 'common_name', 'name', 'fullName', 'full_name'], 'Sconosciuto')),
    rating: Number(pick(raw, ['rating', 'overall'], 0)) || 0,
    position: String(pick(raw, ['position', 'preferredPosition'], '—')),
    club: nomeOppureVuoto(pick(raw, ['club', 'clubName', 'club_name'], '')) || '—',
    league: nomeOppureVuoto(pick(raw, ['league', 'leagueName', 'league_name'], '')) || '—',
    nation: nomeOppureVuoto(pick(raw, ['nation', 'nationName', 'nation_name', 'country'], '')) || '—',
    version: String(pick(raw, ['rarity', 'version', 'cardType'], 'Base')),
    image: String(pick(raw, ['image', 'imagePath'], '')),
  }
}

export async function searchPlayers(query) {
  const term = String(query ?? '').trim()
  if (term.length < 2) return []
  const payload = await cached(`api:search:${term.toLowerCase()}`, TTL.search, () =>
    fetchJson(SEARCH_PATH, { [SEARCH_PARAM]: term, page: 1 }),
  )
  return toArray(payload).map(normalizePlayer).filter(Boolean).slice(0, 25)
}

/**
 * Il blocco dei prezzi può stare sotto chiavi diverse: si cerca in profondità
 * il primo oggetto che contenga le piattaforme.
 */
function trovaPrezzi(node, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 5) return null
  const chiavi = Object.keys(node).map((chiave) => chiave.toLowerCase())
  if (chiavi.includes('ps') || chiavi.includes('playstation') || chiavi.includes('ps4')) return node
  for (const value of Object.values(node)) {
    const trovato = trovaPrezzi(value, depth + 1)
    if (trovato) return trovato
  }
  return null
}

function prezzoDaPiattaforma(node) {
  if (node === null || node === undefined) {
    return { price: 0, minPrice: 0, maxPrice: 0, changePercent: 0, updated: restConfig.label }
  }
  if (typeof node === 'number' || typeof node === 'string') {
    const price = parseCoins(node)
    return { price, minPrice: price, maxPrice: price, changePercent: 0, updated: restConfig.label }
  }
  return {
    price: parseCoins(pick(node, ['LCPrice', 'lowest_bin', 'price', 'current', 'value'], 0)),
    minPrice: parseCoins(pick(node, ['MinPrice', 'min', 'minPrice'], 0)),
    maxPrice: parseCoins(pick(node, ['MaxPrice', 'max', 'maxPrice'], 0)),
    changePercent: Number(pick(node, ['PRP', 'change', 'percent'], 0)) || 0,
    updated: String(pick(node, ['updated', 'updatedAt', 'date'], restConfig.label)),
  }
}

export async function fetchPrices(playerId) {
  const id = String(playerId)
  const payload = await cached(`api:prices:${id}`, TTL.prices, () =>
    fetchJson(PRICE_PATH.replace('{id}', encodeURIComponent(id))),
  )
  const blocco = trovaPrezzi(payload) ?? {}
  const perPiattaforma = (chiavi) => {
    for (const chiave of chiavi) {
      const trovato = Object.entries(blocco).find(([nome]) => nome.toLowerCase() === chiave)
      if (trovato) return prezzoDaPiattaforma(trovato[1])
    }
    return prezzoDaPiattaforma(null)
  }
  return {
    ps: perPiattaforma(['ps', 'playstation', 'ps4', 'ps5']),
    xbox: perPiattaforma(['xbox', 'xb', 'xboxone']),
    pc: perPiattaforma(['pc', 'origin']),
  }
}

/** Lo storico non è previsto: l'app se lo costruisce annotando i prezzi. */
export async function fetchGraph() {
  return []
}

function cached(key, ttl, loader) {
  const hit = cache.get(key)
  if (hit !== undefined) return Promise.resolve(hit)
  return limiter.run(loader).then((value) => {
    cache.set(key, value, ttl)
    return value
  })
}
