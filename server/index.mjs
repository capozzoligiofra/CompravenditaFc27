// Server locale: serve le API e, se esiste, la build dell'interfaccia.
//
// Con HOST=0.0.0.0 (script "npm run mobile") accetta anche le connessioni
// dal telefono collegato alla stessa rete Wi-Fi, e all'avvio stampa gli
// indirizzi da digitare sul telefono.

import { createServer } from 'node:http'
import { networkInterfaces } from 'node:os'

import { statistiche } from './archive.mjs'
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

/**
 * Aggiornamento periodico dell'archivio: spento di default, perché consuma
 * richieste. Con FUT_REFRESH_MINUTES=180 l'app si tiene aggiornata da sola
 * ogni tre ore mentre il server è acceso.
 */
const MINUTI_AGGIORNAMENTO = Number(process.env.FUT_REFRESH_MINUTES ?? 0)
if (MINUTI_AGGIORNAMENTO > 0) {
  const { aggiornaArchivio } = await import('../scripts/aggiorna.mjs')
  const esegui = () => {
    aggiornaArchivio({ silenzioso: true })
      .then((esito) => {
        if (esito.aggiornate > 0) console.log(`[fc27-trader] archivio aggiornato: ${esito.aggiornate} carte`)
      })
      .catch(() => undefined)
  }
  setTimeout(esegui, 30_000).unref?.()
  setInterval(esegui, MINUTI_AGGIORNAMENTO * 60_000).unref?.()
}

server.listen(PORT, HOST, () => {
  console.log(`[fc27-trader] proxy attivo su http://${HOST}:${PORT}`)
  const dettaglio = providerConfig.name === 'futbin' ? ` (anno FC${providerConfig.year})` : ''
  console.log(
    `[fc27-trader] sorgente ${providerConfig.name}${dettaglio}: ${providerConfig.enabled ? 'attiva' : 'non configurata'}`,
  )
  const conti = statistiche()
  console.log(`[fc27-trader] archivio: ${conti.carte} carte, ${conti.puntiStorico} punti di storico`)
  if (MINUTI_AGGIORNAMENTO > 0) {
    console.log(`[fc27-trader] aggiornamento automatico ogni ${MINUTI_AGGIORNAMENTO} minuti`)
  }
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
