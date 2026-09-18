// Indirizzo del proxy dati. Di norma è "/api" (stesso server che serve
// l'app), ma nella versione statica pubblicata su GitHub Pages non esiste
// nessun proxy: lì si può indicarne uno a mano dalle impostazioni.

const KEY = 'fc27-trader:api-base'
const DEFAULT_BASE = import.meta.env.VITE_API_BASE ?? '/api'

export function getApiBase(): string {
  try {
    const stored = localStorage.getItem(KEY)?.trim()
    if (stored) return stored.replace(/\/$/, '')
  } catch {
    // storage non disponibile: si usa il valore predefinito
  }
  return DEFAULT_BASE
}

export function getCustomApiBase(): string {
  try {
    return localStorage.getItem(KEY)?.trim() ?? ''
  } catch {
    return ''
  }
}

export function setCustomApiBase(value: string): void {
  try {
    const clean = value.trim()
    if (clean) localStorage.setItem(KEY, clean)
    else localStorage.removeItem(KEY)
  } catch {
    // niente da fare: resta il valore predefinito per questa sessione
  }
}
