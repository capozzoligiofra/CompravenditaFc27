// Scelta della sorgente dati.
//
// Futbin è il valore predefinito ma rifiuta le richieste dei programmi (403 di
// Cloudflare). In alternativa si può collegare una qualsiasi API REST con
// chiave, impostando FUT_API_BASE e FUT_API_KEY: nessun fornitore è scritto
// nel codice, perché i servizi di dati FUT cambiano nome e chiudono.

import * as futbin from './futbin.mjs'
import * as rest from './rest-provider.mjs'
import { normalizePlatform } from './futbin.mjs'

const SCELTA = String(process.env.FUT_PROVIDER ?? '').toLowerCase()
const usaApi = SCELTA === 'api' || SCELTA === 'futdb' || (SCELTA === '' && rest.restConfig.enabled)

const attivo = usaApi ? rest : futbin

export const providerName = usaApi ? 'api' : 'futbin'

export const providerConfig = usaApi
  ? {
      name: 'api',
      get enabled() {
        return rest.restConfig.enabled
      },
      base: rest.restConfig.base,
      label: rest.restConfig.label,
      year: '',
      configuredYear: '',
      /** Un'API di sola quotazione non dà il passato: lo costruisce l'app. */
      hasHistory: false,
    }
  : {
      name: 'futbin',
      get enabled() {
        return futbin.futbinConfig.enabled
      },
      base: futbin.futbinConfig.base,
      label: 'Futbin',
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
