// Instradamento delle richieste, condiviso fra il server locale
// (server/index.mjs) e la funzione serverless usata dal deploy (api/).
//
// Il proxy esiste per tre motivi: il browser non può chiamare Futbin
// direttamente (CORS), le risposte vanno normalizzate in un formato stabile,
// e le chiamate vanno limitate e messe in cache. Se Futbin non risponde,
// ogni rotta ricade sul dataset demo e lo dichiara nel campo "source".

import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { fetchGraph, fetchPrices, futbinConfig, normalizePlatform, searchPlayers } from './futbin.mjs'
import { demoHistory, demoPlayer, demoPrices, demoRoster, demoSearch } from '../shared/demo.mjs'
import { sendJson } from './util.mjs'

const DIST = resolve(fileURLToPath(new URL('../dist', import.meta.url)))

// Dopo un errore mettiamo Futbin in pausa per un minuto: senza questa
// tregua ogni richiesta pagherebbe di nuovo timeout e attesa del rate
// limiter prima di ripiegare sulla demo, e l'app sembrerebbe bloccata.
const COOLDOWN_MS = Number(process.env.FUTBIN_COOLDOWN_MS ?? 60_000)
const state = { lastError: null, lastErrorAt: null, futbinOk: null, cooldownUntil: 0 }

function noteFailure(error) {
  state.lastError = error instanceof Error ? error.message : String(error)
  state.lastErrorAt = new Date().toISOString()
  state.futbinOk = false
  state.cooldownUntil = Date.now() + COOLDOWN_MS
}

function noteSuccess() {
  state.lastError = null
  state.futbinOk = true
  state.cooldownUntil = 0
}

/** Prova Futbin e, se fallisce, ricade sulla demo senza far esplodere la rotta. */
async function withFallback(live, demo) {
  if (!futbinConfig.enabled) return { source: 'demo', data: demo(), reason: 'Futbin disattivato (FUTBIN_ENABLED=false)' }
  if (Date.now() < state.cooldownUntil) {
    const seconds = Math.ceil((state.cooldownUntil - Date.now()) / 1000)
    return { source: 'demo', data: demo(), reason: `${state.lastError} — nuovo tentativo fra ${seconds}s` }
  }
  try {
    const data = await live()
    const empty = Array.isArray(data) ? data.length === 0 : data === null || data === undefined
    if (empty) throw new Error('Futbin ha restituito una risposta vuota')
    noteSuccess()
    return { source: 'futbin', data }
  } catch (error) {
    noteFailure(error)
    return { source: 'demo', data: demo(), reason: state.lastError }
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
}

/** In produzione lo stesso processo serve anche la build statica di Vite. */
function serveStatic(res, pathname) {
  if (!existsSync(DIST)) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('Build non trovata: esegui "npm run build" oppure usa "npm run dev".')
    return
  }
  const relative = normalize(pathname).replace(/^(\.\.[/\\])+/, '').replace(/^[/\\]+/, '')
  let file = join(DIST, relative)
  if (!file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory()) {
    file = join(DIST, 'index.html')
  }
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' })
  createReadStream(file).pipe(res)
}

export async function handleApi(req, res, url) {
  const platform = normalizePlatform(url.searchParams.get('platform'))
  const path = url.pathname

  if (path === '/api/health') {
    sendJson(res, 200, {
      ok: true,
      futbin: { ...futbinConfig, reachable: state.futbinOk },
      lastError: state.lastError,
      lastErrorAt: state.lastErrorAt,
      retryInSeconds: Math.max(0, Math.ceil((state.cooldownUntil - Date.now()) / 1000)),
      demoPlayers: demoRoster().length,
    })
    return
  }

  if (path === '/api/search') {
    const query = url.searchParams.get('q') ?? ''
    const result = await withFallback(
      () => searchPlayers(query),
      () => demoSearch(query),
    )
    sendJson(res, 200, { source: result.source, reason: result.reason ?? null, players: result.data })
    return
  }

  if (path.startsWith('/api/player/')) {
    const id = decodeURIComponent(path.slice('/api/player/'.length))
    const prices = await withFallback(
      () => fetchPrices(id),
      () => demoPrices(id) ?? {},
    )
    const history = await withFallback(
      () => fetchGraph(id, platform),
      () => demoHistory(id, platform),
    )
    sendJson(res, 200, {
      source: prices.source === 'futbin' && history.source === 'futbin' ? 'futbin' : prices.source,
      reason: prices.reason ?? history.reason ?? null,
      player: demoPlayer(id),
      prices: prices.data,
      history: history.data,
    })
    return
  }

  if (path === '/api/quotes') {
    const ids = (url.searchParams.get('ids') ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, 40)
    const quotes = {}
    let source = 'futbin'
    for (const id of ids) {
      const result = await withFallback(
        () => fetchPrices(id),
        () => demoPrices(id) ?? {},
      )
      if (result.source === 'demo') source = 'demo'
      quotes[id] = result.data?.[platform] ?? null
    }
    sendJson(res, 200, { source: ids.length ? source : 'demo', platform, quotes })
    return
  }

  sendJson(res, 404, { error: 'Rotta non trovata' })
}

/**
 * Gestore completo: API più, se richiesto, i file statici della build.
 * In serverless i file li serve la piattaforma, quindi `withStatic` è false.
 */
export function handleRequest(req, res, { withStatic = true } = {}) {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
  if (!url.pathname.startsWith('/api/')) {
    if (!withStatic) {
      sendJson(res, 404, { error: 'Rotta non trovata' })
      return
    }
    serveStatic(res, url.pathname)
    return
  }
  handleApi(req, res, url).catch((error) => {
    noteFailure(error)
    sendJson(res, 500, { error: state.lastError })
  })
}
