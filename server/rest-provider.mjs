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

/**
 * Preimpostazioni per i servizi già noti, così non servono sei variabili.
 * Restano solo indirizzi e percorsi: nessuna chiave, e ogni valore resta
 * sovrascrivibile.
 */
const PRESET = {
  'fut-db': {
    base: 'https://api.fut-db.com/api',
    keyHeader: 'X-AUTH-TOKEN',
    searchPath: '/players/search',
    searchParam: 'name',
    searchMethod: 'POST',
    pricePath: '/players/{id}/price',
  },
}

const preset = PRESET[String(process.env.FUT_API_PRESET ?? '').toLowerCase()] ?? {}

const BASE = (process.env.FUT_API_BASE ?? process.env.FUTDB_BASE ?? preset.base ?? '').replace(/\/$/, '')
const KEY = process.env.FUT_API_KEY ?? process.env.FUTDB_KEY ?? ''
const KEY_HEADER = process.env.FUT_API_KEY_HEADER ?? preset.keyHeader ?? 'X-AUTH-TOKEN'
const SEARCH_PATH = process.env.FUT_API_SEARCH_PATH ?? process.env.FUTDB_SEARCH_PATH ?? preset.searchPath ?? '/players/search'
const SEARCH_PARAM = process.env.FUT_API_SEARCH_PARAM ?? preset.searchParam ?? 'name'
// Alcune API vogliono la ricerca in POST con il nome nel corpo (FUT-DB fa così).
const SEARCH_METHOD = (process.env.FUT_API_SEARCH_METHOD ?? preset.searchMethod ?? 'GET').toUpperCase()
const PRICE_PATH = process.env.FUT_API_PRICE_PATH ?? process.env.FUTDB_PRICE_PATH ?? preset.pricePath ?? '/players/{id}/price'
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

/** Con l'intestazione Authorization la chiave va preceduta da "Bearer". */
function valoreChiave() {
  if (KEY_HEADER.toLowerCase() === 'authorization' && !/^(bearer|basic|token)\s/i.test(KEY)) {
    return `Bearer ${KEY}`
  }
  return KEY
}

async function fetchJson(path, params, { method = 'GET', body = null } = {}) {
  if (!BASE) throw new Error("Manca l'indirizzo dell'API: imposta FUT_API_BASE")
  if (!KEY) throw new Error('Manca la chiave: impostala in FUT_API_KEY')
  const target = new URL(`${BASE}${path}`)
  for (const [key, value] of Object.entries(params ?? {})) target.searchParams.set(key, String(value))

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let response
  try {
    response = await fetch(target, {
      method,
      signal: controller.signal,
      headers: {
        accept: 'application/json',
        [KEY_HEADER]: valoreChiave(),
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
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
    SEARCH_METHOD === 'POST'
      ? fetchJson(SEARCH_PATH, { page: 1 }, { method: 'POST', body: { [SEARCH_PARAM]: term } })
      : fetchJson(SEARCH_PATH, { [SEARCH_PARAM]: term, page: 1 }),
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

const PREZZI_NON_INCLUSI = 'I prezzi richiedono un abbonamento a pagamento su questo servizio'

/**
 * Su alcuni servizi i prezzi sono riservati agli abbonati. In quel caso non ha
 * senso insistere a ogni carta né considerarlo un guasto: si annota una volta
 * e si restituiscono quotazioni vuote, che l'app riempie con i prezzi scritti
 * a mano continuando a usare il servizio per la ricerca.
 */
export const restState = { prezziPremium: false }

function prezziVuoti(motivo) {
  const vuoto = { price: 0, minPrice: 0, maxPrice: 0, changePercent: 0, updated: motivo }
  return { ps: { ...vuoto }, xbox: { ...vuoto }, pc: { ...vuoto } }
}

export async function fetchPrices(playerId) {
  const id = String(playerId)
  if (restState.prezziPremium) return prezziVuoti(PREZZI_NON_INCLUSI)
  let payload
  try {
    payload = await cached(`api:prices:${id}`, TTL.prices, () =>
      fetchJson(PRICE_PATH.replace('{id}', encodeURIComponent(id))),
    )
  } catch (error) {
    const messaggio = error instanceof Error ? error.message : String(error)
    if (/premium|abbonamento|HTTP 40[13]|rifiuta la chiave/i.test(messaggio)) {
      restState.prezziPremium = true
      console.log(`[fc27-trader] ${PREZZI_NON_INCLUSI}: uso la ricerca del servizio e i prezzi scritti a mano.`)
      return prezziVuoti(PREZZI_NON_INCLUSI)
    }
    throw error
  }
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
