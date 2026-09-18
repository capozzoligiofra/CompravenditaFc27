// Dopo la build scrive dentro dist/sw.js l'elenco dei file da mettere in
// cache e una versione derivata dai nomi generati da Vite: così ogni build
// invalida la cache precedente e l'app funziona offline già dalla prima
// visita.

import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIST = resolve(fileURLToPath(new URL('../dist', import.meta.url)))
// Stessa base usata da Vite: su GitHub Pages i file stanno in /nome-repo/.
const BASE = (process.env.VITE_BASE ?? '/').replace(/\/*$/, '/')
const SW = join(DIST, 'sw.js')

if (!existsSync(SW)) {
  console.error('[fc27-trader] dist/sw.js non trovato: la build è completa?')
  process.exit(1)
}

function walk(dir, prefix = '') {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    const url = `${prefix}/${entry.name}`
    if (entry.isDirectory()) return walk(path, url)
    return [url]
  })
}

// Il service worker non mette in cache sé stesso, e index.html è già coperto
// dalla voce '/' (la navigazione passa sempre da lì).
const skip = new Set(['/sw.js', '/index.html'])
const files = walk(DIST)
  .filter((file) => !skip.has(file))
  .map((file) => `${BASE}${file.replace(/^\//, '')}`)
const precache = [BASE, ...files].sort()
const version = createHash('sha1').update(precache.join('|')).digest('hex').slice(0, 8)

const source = readFileSync(SW, 'utf8')
  .replace('__BUILD_VERSION__', version)
  .replace(
    /const PRECACHE = \[[^\]]*\]/,
    `const PRECACHE = ${JSON.stringify(precache, null, 2).replace(/\n/g, '\n')}`,
  )

writeFileSync(SW, source)
console.log(`[fc27-trader] service worker aggiornato: versione ${version}, ${precache.length} file in cache`)
