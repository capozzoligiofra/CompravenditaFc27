// Service worker: serve a installare l'app sul telefono e a tenerla usabile
// anche senza rete. Calcolatore, watchlist e portafoglio vivono in
// localStorage, quindi offline funzionano comunque; qui mettiamo al riparo
// il guscio dell'app e l'ultima risposta ricevuta dal proxy.

// L'elenco dei file e la versione vengono riscritti dopo la build da
// scripts/postbuild-sw.mjs: senza, i file caricati alla prima visita non
// finirebbero in cache (la pagina non era ancora controllata dal worker) e
// l'app offline resterebbe bianca.
const VERSION = '__BUILD_VERSION__'
const PRECACHE = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png']
const SHELL_CACHE = `fc27-shell-${VERSION}`
const ASSET_CACHE = `fc27-assets-${VERSION}`
const API_CACHE = `fc27-api-${VERSION}`
const CURRENT = [SHELL_CACHE, ASSET_CACHE, API_CACHE]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => undefined),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => !CURRENT.includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

/** Prima la rete: i prezzi vecchi si mostrano solo se il telefono è offline. */
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
    }
    return response
  } catch (error) {
    const cached = await caches.match(request)
    if (!cached) throw error
    // L'app deve poter dire «questi prezzi sono quelli salvati», quindi la
    // risposta dalla cache viene marcata con un'intestazione.
    const headers = new Headers(cached.headers)
    headers.set('x-fc27-from-cache', '1')
    return new Response(await cached.blob(), { status: cached.status, statusText: cached.statusText, headers })
  }
}

/** Prima la cache: i file con hash nel nome non cambiano mai contenuto. */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) {
    const cache = await caches.open(cacheName)
    cache.put(request, response.clone())
  }
  return response
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, API_CACHE))
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      networkFirst(request, SHELL_CACHE).catch(() => caches.match('/').then((cached) => cached ?? Response.error())),
    )
    return
  }

  event.respondWith(cacheFirst(request, ASSET_CACHE))
})
