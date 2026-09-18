import type { AppData } from '../types.ts'

const KEY = 'fc27-trader:v1'

export const defaultData: AppData = {
  settings: { platform: 'ps', taxPercent: 5, targetMarginPercent: 15, budget: 0 },
  watchlist: [],
  positions: [],
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
  }
}
