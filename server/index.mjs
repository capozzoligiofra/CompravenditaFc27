// Server locale: serve le API e, se esiste, la build dell'interfaccia.
//
// Con HOST=0.0.0.0 (script "npm run mobile") accetta anche le connessioni
// dal telefono collegato alla stessa rete Wi-Fi, e all'avvio stampa gli
// indirizzi da digitare sul telefono.

import { createServer } from 'node:http'
import { networkInterfaces } from 'node:os'

import { providerConfig } from './providers.mjs'
import { handleRequest } from './router.mjs'

const PORT = Number(process.env.PORT ?? 8787)
const HOST = process.env.HOST ?? '127.0.0.1'

/** Indirizzi IPv4 della macchina sulla rete locale, quelli utili dal telefono. */
export function localAddresses() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((entry) => entry && entry.family === 'IPv4' && !entry.internal)
    .map((entry) => entry.address)
}

const server = createServer((req, res) => handleRequest(req, res))

server.listen(PORT, HOST, () => {
  console.log(`[fc27-trader] proxy attivo su http://${HOST}:${PORT}`)
  const dettaglio = providerConfig.name === 'futbin' ? ` (anno FC${providerConfig.year})` : ''
  console.log(
    `[fc27-trader] sorgente ${providerConfig.name}${dettaglio}: ${providerConfig.enabled ? 'attiva' : 'non configurata'}`,
  )
  if (HOST === '0.0.0.0' || HOST === '::') {
    const addresses = localAddresses()
    if (addresses.length === 0) {
      console.log('[fc27-trader] nessun indirizzo di rete trovato: controlla di essere connesso al Wi-Fi.')
    } else {
      console.log('\n  Dal telefono (stessa rete Wi-Fi) apri:')
      for (const address of addresses) console.log(`    http://${address}:${PORT}`)
      console.log('')
    }
  }
})
