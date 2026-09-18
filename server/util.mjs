// Utilità condivise dal proxy: parsing dei prezzi, cache a TTL e rate limiter.

/**
 * Futbin restituisce i prezzi in formati diversi a seconda dell'endpoint:
 * "1,200", "850K", "1.2M", 1200, "0" o stringhe vuote. Qui li normalizziamo
 * sempre in numero di crediti (0 = prezzo non disponibile).
 */
export function parseCoins(raw) {
  if (raw === null || raw === undefined) return 0
  if (typeof raw === 'number') return Number.isFinite(raw) ? Math.round(raw) : 0
  const text = String(raw).trim().toLowerCase().replace(/\s|,/g, '')
  if (!text || text === '0' || text === 'na' || text === 'n/a') return 0
  const match = text.match(/^([\d.]+)([km])?$/)
  if (!match) return 0
  const value = Number.parseFloat(match[1])
  if (!Number.isFinite(value)) return 0
  const factor = match[2] === 'm' ? 1_000_000 : match[2] === 'k' ? 1_000 : 1
  return Math.round(value * factor)
}

export function parsePercent(raw) {
  if (raw === null || raw === undefined) return 0
  const value = Number.parseFloat(String(raw).replace('%', '').replace(',', '.'))
  return Number.isFinite(value) ? value : 0
}

/** Cache in memoria con scadenza, per non martellare la sorgente dati. */
export class TtlCache {
  constructor(maxEntries = 500) {
    this.maxEntries = maxEntries
    this.entries = new Map()
  }

  get(key) {
    const entry = this.entries.get(key)
    if (!entry) return undefined
    if (entry.expiresAt < Date.now()) {
      this.entries.delete(key)
      return undefined
    }
    return entry.value
  }

  set(key, value, ttlMs) {
    if (this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value
      if (oldest !== undefined) this.entries.delete(oldest)
    }
    this.entries.set(key, { value, expiresAt: Date.now() + ttlMs })
  }

  clear() {
    this.entries.clear()
  }
}

/**
 * Coda con una sola richiesta in volo e una pausa minima fra una e l'altra:
 * l'app resta un client "gentile" anche se l'utente clicca in fretta.
 */
export class RateLimiter {
  constructor(minIntervalMs = 1200) {
    this.minIntervalMs = minIntervalMs
    this.chain = Promise.resolve()
    this.lastRunAt = 0
  }

  run(task) {
    const result = this.chain.then(async () => {
      const wait = this.lastRunAt + this.minIntervalMs - Date.now()
      if (wait > 0) await sleep(wait)
      this.lastRunAt = Date.now()
      return task()
    })
    this.chain = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function sendJson(res, status, payload) {
  const body = JSON.stringify(payload)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  })
  res.end(body)
}
