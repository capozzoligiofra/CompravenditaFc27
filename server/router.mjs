// Instradamento delle richieste, condiviso fra il server locale
// (server/index.mjs) e la funzione serverless usata dal deploy (api/).
//
// Il proxy esiste per tre motivi: il browser non può chiamare Futbin
// direttamente (CORS), le risposte vanno normalizzate in un formato stabile,
// e le chiamate vanno limitate e messe in cache. Se la sorgente non risponde,
// ogni rotta ricade sull'archivio dei prezzi veri — quelli raccolti da voi —
// e lo dichiara nel campo "source". Prezzi inventati non ne esistono più.

import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import * as archivio from './archive.mjs'
import { fetchCatalysts } from './catalysts.mjs'
import { fetchGraph, fetchPrices, normalizePlatform, providerConfig, searchPlayers } from './providers.mjs'
import { sendJson } from './util.mjs'

const DIST = resolve(fileURLToPath(new URL('../dist', import.meta.url)))

// Dopo un errore mettiamo la sorgente in pausa per un minuto: senza questa
// tregua ogni richiesta pagherebbe di nuovo timeout e attesa del rate
// limiter prima di ripiegare sull'archivio, e l'app sembrerebbe bloccata.
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

/**
 * Prova la sorgente e, se fallisce, ricade su quello che abbiamo in casa
 * senza far esplodere la rotta.
 *
 * `emptyIsFailure` distingue due casi che sembrano uguali: per i prezzi una
 * risposta vuota è un guasto, per una ricerca no — cercare un nome che non
 * esiste dà zero risultati ed è normale. Confonderli metteva in pausa la
 * sorgente a ogni ricerca a vuoto, compresa quella che parte a schermo
 * appena aperto.
 */
async function withFallback(live, riserva, { emptyIsFailure = true } = {}) {
  if (!providerConfig.enabled) {
    const motivo =
      providerConfig.name === 'futdb'
        ? 'Manca la chiave FutDB (FUTDB_KEY)'
        : 'Futbin disattivato (FUTBIN_ENABLED=false)'
    return { source: 'locale', data: riserva(), reason: motivo }
  }
  if (Date.now() < state.cooldownUntil) {
    const seconds = Math.ceil((state.cooldownUntil - Date.now()) / 1000)
    return { source: 'locale', data: riserva(), reason: `${state.lastError} — nuovo tentativo fra ${seconds}s` }
  }
  try {
    const data = await live()
    const vuoto = Array.isArray(data) ? data.length === 0 : data === null || data === undefined
    if (vuoto && emptyIsFailure) throw new Error(`${providerConfig.name}: risposta vuota`)
    noteSuccess()
    return { source: providerConfig.name, data }
  } catch (error) {
    noteFailure(error)
    return { source: 'locale', data: riserva(), reason: state.lastError }
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
      futbin: { ...providerConfig, reachable: state.futbinOk },
      lastError: state.lastError,
      lastErrorAt: state.lastErrorAt,
      retryInSeconds: Math.max(0, Math.ceil((state.cooldownUntil - Date.now()) / 1000)),
    })
    return
  }

  if (path === '/api/search') {
    const query = url.searchParams.get('q') ?? ''
    // Senza sorgente la ricerca non inventa nomi: l'elenco delle carte lo
    // costruisce l'app, fra quelle che seguite e quelle del listino comune.
    const result = await withFallback(() => searchPlayers(query), () => [], { emptyIsFailure: false })
    sendJson(res, 200, { source: result.source, reason: result.reason ?? null, players: result.data })
    return
  }

  if (path.startsWith('/api/player/')) {
    const id = decodeURIComponent(path.slice('/api/player/'.length))
    const prices = await withFallback(() => fetchPrices(id), () => prezziDaArchivio(id))
    if (prices.source !== 'locale') annotaPrezzi(id, prices.data)
    // Con una sorgente senza storico non si finge un fallimento: si risponde
    // vuoto e ci pensa lo storico costruito dall'app.
    const history = providerConfig.hasHistory
      ? await withFallback(() => fetchGraph(id, platform), () => [])
      : { source: prices.source, data: [] }
    const storicoArchivio = archivio.leggiStorico(id, platform)
    const storico = history.data?.length ? history.data : storicoArchivio

    sendJson(res, 200, {
      source: prices.source === 'locale' || history.source === 'locale' ? 'locale' : prices.source,
      reason: prices.reason ?? history.reason ?? null,
      player: archivio.leggiGiocatore(id),
      prices: prices.data,
      history: storico,
    })
    return
  }

  if (path === '/api/catalysts') {
    // SBC e obiettivi in corso. Sono un "meglio di niente": se Futbin non
    // risponde o cambia pagina, l'elenco resta vuoto e l'app usa il
    // calendario e i catalizzatori inseriti a mano.
    // Errori gestiti qui e non con withFallback di proposito: un elenco
    // vuoto di SBC non deve mettere in pausa anche le richieste dei prezzi.
    if (providerConfig.name !== 'futbin' || !providerConfig.enabled) {
      sendJson(res, 200, {
        source: 'locale',
        reason:
          providerConfig.name === 'futbin'
            ? 'Futbin disattivato (FUTBIN_ENABLED=false)'
            : 'Le SBC si leggono solo da Futbin: con FutDB vanno inserite a mano',
        catalysts: [],
      })
      return
    }
    try {
      const catalysts = await fetchCatalysts()
      sendJson(res, 200, {
        source: catalysts.length > 0 ? 'futbin' : 'locale',
        reason: catalysts.length > 0 ? null : 'Nessuna SBC o obiettivo riconosciuto sulle pagine di Futbin',
        catalysts,
      })
    } catch (error) {
      sendJson(res, 200, {
        source: 'locale',
        reason: error instanceof Error ? error.message : 'Catalizzatori non disponibili',
        catalysts: [],
      })
    }
    return
  }

  if (path === '/api/quotes') {
    const ids = (url.searchParams.get('ids') ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, providerConfig.maxQuotes ?? 40)
    const quotes = {}
    let source = providerConfig.name
    for (const id of ids) {
      const result = await withFallback(() => fetchPrices(id), () => prezziDaArchivio(id))
      if (result.source === 'locale') source = 'locale'
      else annotaPrezzi(id, result.data)
      quotes[id] = result.data?.[platform] ?? null
    }
    sendJson(res, 200, { source: ids.length ? source : 'locale', platform, quotes })
    return
  }

  if (path === '/api/archivio') {
    sendJson(res, 200, { ...archivio.statistiche(), motore: archivio.motore })
    return
  }

  // Le carte che si sono mosse di più fra tutte quelle archiviate: è la
  // domanda per cui serviva un database vero.
  if (path === '/api/movimenti') {
    const giorni = Math.max(1, Math.min(30, Number(url.searchParams.get('giorni') ?? 3)))
    const limite = Math.max(1, Math.min(50, Number(url.searchParams.get('limite') ?? 15)))
    const verso = url.searchParams.get('verso') === 'rialzo' ? 'rialzo' : 'calo'
    sendJson(res, 200, {
      motore: archivio.motore,
      giorni,
      verso,
      carte: archivio.movimenti({ piattaforma: platform, giorni, limite, verso }),
    })
    return
  }

  // L'app dichiara quali carte le interessano: sono quelle che il comando di
  // aggiornamento terrà fresche.
  if (path === '/api/interesse' && req.method === 'POST') {
    const corpo = await leggiCorpo(req)
    const ids = Array.isArray(corpo?.ids) ? corpo.ids : []
    sendJson(res, 200, { interesse: archivio.impostaInteresse(ids).length })
    return
  }

  // Prezzo scritto a mano dall'utente: entra nell'archivio, così vale anche
  // sugli altri dispositivi.
  if (path === '/api/prezzo' && req.method === 'POST') {
    const corpo = await leggiCorpo(req)
    const id = String(corpo?.id ?? '')
    const price = Number(corpo?.price ?? 0)
    if (!id || !(price > 0)) {
      sendJson(res, 400, { error: 'Servono id e price' })
      return
    }
    archivio.registraPrezzo(id, normalizePlatform(corpo?.platform), { price, updated: 'scritto da te' }, 'manuale')
    if (corpo?.player) archivio.ricordaGiocatore(corpo.player)
    sendJson(res, 200, { ok: true })
    return
  }

  sendJson(res, 404, { error: 'Rotta non trovata' })
}

/** Prima la sorgente, poi l'archivio: un prezzo vero vecchio è pur sempre vero. */
/** I prezzi che abbiamo in archivio: veri, raccolti da voi, magari vecchi. */
function prezziDaArchivio(id) {
  const perPiattaforma = {}
  let trovato = false
  for (const piattaforma of ['ps', 'xbox', 'pc']) {
    const voce = archivio.leggiPrezzo(id, piattaforma)
    if (voce) {
      perPiattaforma[piattaforma] = voce
      trovato = true
    }
  }
  return trovato ? perPiattaforma : {}
}

function annotaPrezzi(id, prezzi) {
  for (const [piattaforma, quote] of Object.entries(prezzi ?? {})) {
    archivio.registraPrezzo(id, piattaforma, quote)
  }
}

function leggiCorpo(req) {
  return new Promise((resolve) => {
    const pezzi = []
    let dimensione = 0
    req.on('data', (pezzo) => {
      dimensione += pezzo.length
      if (dimensione > 64 * 1024) {
        req.destroy()
        resolve(null)
        return
      }
      pezzi.push(pezzo)
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(pezzi).toString() || '{}'))
      } catch {
        resolve(null)
      }
    })
    req.on('error', () => resolve(null))
  })
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
