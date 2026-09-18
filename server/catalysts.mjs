// Catalizzatori letti da Futbin: SBC e obiettivi in corso.
//
// Queste pagine sono HTML pensato per gli occhi, non per un programma: qui
// se ne estrae il poco che è stabile (titolo e link della sfida) e se ne
// ricava una regola di corrispondenza leggendo il titolo, dove EA e Futbin
// mettono quasi sempre lega, nazione o valutazione richiesta.
//
// È volutamente un "meglio di niente": se la pagina cambia forma non si
// rompe nulla, semplicemente non arrivano catalizzatori e restano quelli
// del calendario e quelli inseriti a mano nell'app.

import { RateLimiter, TtlCache } from './util.mjs'

const GAME_YEAR = process.env.FC27_YEAR ?? '27'
const BASE = (process.env.FUTBIN_BASE ?? 'https://www.futbin.com').replace(/\/$/, '')
const SBC_URL = process.env.FUTBIN_SBC_URL ?? `${BASE}/${GAME_YEAR}/squad-building-challenges`
const OBJECTIVES_URL = process.env.FUTBIN_OBJECTIVES_URL ?? `${BASE}/${GAME_YEAR}/objectives`
const TIMEOUT_MS = Number(process.env.FUTBIN_TIMEOUT_MS ?? 9000)
const TTL_MS = Number(process.env.FUTBIN_TTL_CATALYSTS_MS ?? 30 * 60 * 1000)

const limiter = new RateLimiter(Number(process.env.FUTBIN_MIN_INTERVAL_MS ?? 1200))
const cache = new TtlCache(50)

const LEGHE = [
  'Premier League',
  'Serie A',
  'LaLiga',
  'La Liga',
  'Bundesliga',
  'Ligue 1',
  'Eredivisie',
  'Liga Portugal',
  'Saudi League',
  'MLS',
]

const NAZIONI = [
  'England',
  'Italy',
  'France',
  'Germany',
  'Spain',
  'Portugal',
  'Brazil',
  'Argentina',
  'Netherlands',
  'Belgium',
  'Norway',
  'Sweden',
  'Morocco',
  'Nigeria',
]

async function fetchHtml(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'it-IT,it;q=0.9,en;q=0.8',
        'user-agent': process.env.FUTBIN_USER_AGENT ?? 'fc27-trader/0.1 (uso personale)',
      },
    })
    if (!response.ok) throw new Error(`Futbin ha risposto ${response.status}`)
    return await response.text()
  } finally {
    clearTimeout(timer)
  }
}

function decodeEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

/** Titoli e link delle voci di una pagina elenco (SBC oppure obiettivi). */
function extractEntries(html, pathFragment) {
  const pattern = new RegExp(`<a[^>]+href="([^"]*${pathFragment}/[^"#?]+)"[^>]*>([\\s\\S]{0,200}?)</a>`, 'gi')
  const entries = new Map()
  for (const match of html.matchAll(pattern)) {
    const href = match[1]
    const title = decodeEntities(match[2].replace(/<[^>]*>/g, ' '))
      .replace(/\s+/g, ' ')
      .trim()
    if (!title || title.length < 3 || title.length > 80) continue
    if (/^(vedi|view|all|tutti)\b/i.test(title)) continue
    if (!entries.has(title)) entries.set(title, href.startsWith('http') ? href : `${BASE}${href}`)
  }
  return [...entries.entries()].map(([title, url]) => ({ title, url }))
}

/** Dal titolo si ricava chi viene richiesto: valutazione, lega, nazione. */
function ruleFromTitle(title) {
  const rule = { players: [] }
  const rating = title.match(/(\d{2})\s*\+/)
  if (rating) {
    const value = Number(rating[1])
    if (value >= 75 && value <= 95) rule.minRating = value
  }
  const leghe = LEGHE.filter((lega) => title.toLowerCase().includes(lega.toLowerCase()))
  if (leghe.length > 0) rule.leagues = leghe
  const nazioni = NAZIONI.filter((nazione) => new RegExp(`\\b${nazione}\\b`, 'i').test(title))
  if (nazioni.length > 0) rule.nations = nazioni
  return rule
}

function toCatalyst(kind, entry) {
  const rule = ruleFromTitle(entry.title)
  const mirato = Boolean(rule.minRating || rule.leagues || rule.nations)
  return {
    id: `${kind}:${entry.title.toLowerCase().replace(/\s+/g, '-').slice(0, 60)}`,
    kind,
    title: entry.title,
    detail: mirato
      ? `Richiesta letta dal titolo su Futbin: ${describe(rule)}.`
      : 'Attiva su Futbin: nessun requisito riconosciuto dal titolo, controlla in gioco.',
    source: 'futbin',
    startsAt: null,
    endsAt: null,
    impact: mirato ? (kind === 'sbc' ? 3 : 2) : 1,
    match: {
      minRating: rule.minRating ?? null,
      maxRating: null,
      leagues: rule.leagues ?? [],
      nations: rule.nations ?? [],
      clubs: [],
      positions: [],
      players: [],
    },
    url: entry.url,
  }
}

function describe(rule) {
  const parti = []
  if (rule.minRating) parti.push(`valutazione ${rule.minRating}+`)
  if (rule.leagues) parti.push(`lega ${rule.leagues.join(', ')}`)
  if (rule.nations) parti.push(`nazione ${rule.nations.join(', ')}`)
  return parti.join(' · ')
}

/**
 * Elenco dei catalizzatori attivi. Le voci senza alcun requisito
 * riconosciuto vengono scartate: riempirebbero la pagina senza dire nulla.
 */
export async function fetchCatalysts() {
  const cached = cache.get('catalysts')
  if (cached) return cached

  const catalysts = await limiter.run(async () => {
    const [sbcHtml, objectivesHtml] = await Promise.all([
      fetchHtml(SBC_URL).catch(() => ''),
      fetchHtml(OBJECTIVES_URL).catch(() => ''),
    ])
    if (!sbcHtml && !objectivesHtml) throw new Error('Nessuna pagina di Futbin raggiungibile')

    const sbc = extractEntries(sbcHtml, 'squad-building-challenges').map((entry) => toCatalyst('sbc', entry))
    const objectives = extractEntries(objectivesHtml, 'objectives').map((entry) => toCatalyst('obiettivo', entry))
    return [...sbc, ...objectives].filter((catalyst) => catalyst.impact > 1).slice(0, 30)
  })

  cache.set('catalysts', catalysts, TTL_MS)
  return catalysts
}

export const catalystsConfig = { sbcUrl: SBC_URL, objectivesUrl: OBJECTIVES_URL }
