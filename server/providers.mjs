// Scelta della sorgente dati.
//
// Futbin resta il valore predefinito, ma rifiuta le richieste dei programmi
// (403 di Cloudflare). FutDB invece pubblica un'API con chiave gratuita:
// basta impostare FUTDB_KEY e l'app la usa al posto di Futbin.

import * as futbin from './futbin.mjs'
import * as futdb from './futdb.mjs'
import { normalizePlatform } from './futbin.mjs'

const SCELTA = String(process.env.FUT_PROVIDER ?? '').toLowerCase()
const usaFutdb = SCELTA === 'futdb' || (SCELTA === '' && futdb.futdbConfig.enabled)

const attivo = usaFutdb ? futdb : futbin

export const providerName = usaFutdb ? 'futdb' : 'futbin'

export const providerConfig = usaFutdb
  ? {
      name: 'futdb',
      enabled: futdb.futdbConfig.enabled,
      base: futdb.futdbConfig.base,
      year: '',
      configuredYear: '',
      /** FutDB non dà lo storico: lo costruisce l'app annotando i prezzi. */
      hasHistory: false,
    }
  : {
      name: 'futbin',
      get enabled() {
        return futbin.futbinConfig.enabled
      },
      base: futbin.futbinConfig.base,
      get year() {
        return futbin.futbinConfig.year
      },
      configuredYear: futbin.futbinConfig.configuredYear,
      hasHistory: true,
    }

export const searchPlayers = attivo.searchPlayers
export const fetchPrices = attivo.fetchPrices
export const fetchGraph = attivo.fetchGraph
export { normalizePlatform }
