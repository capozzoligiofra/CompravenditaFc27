import type { AppData } from '../types.ts'

const KEY = 'fc27-trader:v1'

export const defaultData: AppData = {
  settings: { platform: 'ps', taxPercent: 5, targetMarginPercent: 15, budget: 0, notifications: false },
  watchlist: [],
  positions: [],
  catalysts: [],
  alerts: [],
  seen: [],
  manualPrices: {},
  priceHistory: {},
  sharedPrices: {},
  sharedPlayers: {},
  syncedAt: 0,
  syncedPlatform: 'ps',
  dataChangedAt: 0,
}

/** Lo stato vive solo nel browser: nessun account, nessun dato inviato altrove. */
export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaultData
    const parsed = JSON.parse(raw) as Partial<AppData>
    return {
      settings: { ...defaultData.settings, ...(parsed.settings ?? {}) },
      watchlist: Array.isArray(parsed.watchlist) ? parsed.watchlist : [],
      positions: Array.isArray(parsed.positions) ? parsed.positions : [],
      catalysts: Array.isArray(parsed.catalysts) ? parsed.catalysts : [],
      alerts: Array.isArray(parsed.alerts) ? parsed.alerts : [],
      seen: Array.isArray(parsed.seen) ? parsed.seen : [],
      manualPrices: isRecord(parsed.manualPrices) ? parsed.manualPrices : {},
      priceHistory: isPlainObject(parsed.priceHistory) ? parsed.priceHistory : {},
      // Il listino comune è una copia locale di quello del server: se manca,
      // la prima sincronizzazione lo riporta.
      sharedPrices: isRecord(parsed.sharedPrices) ? parsed.sharedPrices : {},
      sharedPlayers: isPlainObject(parsed.sharedPlayers) ? parsed.sharedPlayers : {},
      syncedAt: Number(parsed.syncedAt) || 0,
      syncedPlatform: parsed.syncedPlatform ?? 'ps',
      dataChangedAt: Number(parsed.dataChangedAt) || 0,
    }
  } catch {
    return defaultData
  }
}

export function saveData(data: AppData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data))
  } catch {
    // Spazio esaurito o storage bloccato: l'app continua a funzionare in memoria.
  }
}

export function exportData(data: AppData): string {
  return JSON.stringify(data, null, 2)
}

export function importData(raw: string): AppData {
  const parsed = JSON.parse(raw) as Partial<AppData>
  return {
    settings: { ...defaultData.settings, ...(parsed.settings ?? {}) },
    watchlist: Array.isArray(parsed.watchlist) ? parsed.watchlist : [],
    positions: Array.isArray(parsed.positions) ? parsed.positions : [],
    catalysts: Array.isArray(parsed.catalysts) ? parsed.catalysts : [],
    alerts: Array.isArray(parsed.alerts) ? parsed.alerts : [],
    seen: Array.isArray(parsed.seen) ? parsed.seen : [],
    manualPrices: isRecord(parsed.manualPrices) ? parsed.manualPrices : {},
    priceHistory: isPlainObject(parsed.priceHistory) ? parsed.priceHistory : {},
    sharedPrices: isRecord(parsed.sharedPrices) ? parsed.sharedPrices : {},
    sharedPlayers: isPlainObject(parsed.sharedPlayers) ? parsed.sharedPlayers : {},
    syncedAt: Number(parsed.syncedAt) || 0,
    syncedPlatform: parsed.syncedPlatform ?? 'ps',
    dataChangedAt: Number(parsed.dataChangedAt) || 0,
  }
}

function isPlainObject<T>(value: unknown): value is Record<string, T> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isRecord(value: unknown): value is Record<string, { price: number; at: number; autore?: string }> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
