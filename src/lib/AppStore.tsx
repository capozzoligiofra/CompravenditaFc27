import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import type { Catalyst } from '../../shared/catalysts.d.mts'
import { normalizeCatalyst } from '../../shared/catalysts.mjs'
import type { Alert, AppData, Player, Position, Settings, WatchItem } from '../types.ts'
import { defaultData, loadData, saveData } from './storage.ts'

export interface Store {
  data: AppData
  settings: Settings
  updateSettings: (patch: Partial<Settings>) => void
  addWatch: (item: Omit<WatchItem, 'addedAt'>) => void
  updateWatch: (id: string, patch: Partial<WatchItem>) => void
  removeWatch: (id: string) => void
  isWatched: (id: string) => boolean
  addPosition: (position: Omit<Position, 'id' | 'buyAt' | 'sellPrice' | 'sellAt'>) => void
  closePosition: (id: string, sellPrice: number) => void
  reopenPosition: (id: string) => void
  removePosition: (id: string) => void
  rememberPlayer: (player: Player) => void
  addCatalyst: (raw: Partial<Catalyst> & { title: string }) => void
  removeCatalyst: (id: string) => void
  pushAlerts: (alerts: Alert[]) => Alert[]
  markAlertsRead: () => void
  removeAlert: (id: string) => void
  clearAlerts: () => void
  replaceAll: (data: AppData) => void
  reset: () => void
}

export const StoreContext = createContext<Store | null>(null)

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => loadData())

  useEffect(() => {
    saveData(data)
  }, [data])

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setData((current) => ({ ...current, settings: { ...current.settings, ...patch } }))
  }, [])

  const addWatch = useCallback((item: Omit<WatchItem, 'addedAt'>) => {
    setData((current) => {
      if (current.watchlist.some((entry) => entry.id === item.id)) return current
      return { ...current, watchlist: [{ ...item, addedAt: Date.now() }, ...current.watchlist] }
    })
  }, [])

  const updateWatch = useCallback((id: string, patch: Partial<WatchItem>) => {
    setData((current) => ({
      ...current,
      watchlist: current.watchlist.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    }))
  }, [])

  const removeWatch = useCallback((id: string) => {
    setData((current) => ({ ...current, watchlist: current.watchlist.filter((entry) => entry.id !== id) }))
  }, [])

  const addPosition = useCallback((position: Omit<Position, 'id' | 'buyAt' | 'sellPrice' | 'sellAt'>) => {
    setData((current) => ({
      ...current,
      positions: [
        { ...position, id: newId(), buyAt: Date.now(), sellPrice: null, sellAt: null },
        ...current.positions,
      ],
    }))
  }, [])

  const closePosition = useCallback((id: string, sellPrice: number) => {
    setData((current) => ({
      ...current,
      positions: current.positions.map((entry) =>
        entry.id === id ? { ...entry, sellPrice, sellAt: Date.now() } : entry,
      ),
    }))
  }, [])

  const reopenPosition = useCallback((id: string) => {
    setData((current) => ({
      ...current,
      positions: current.positions.map((entry) =>
        entry.id === id ? { ...entry, sellPrice: null, sellAt: null } : entry,
      ),
    }))
  }, [])

  const removePosition = useCallback((id: string) => {
    setData((current) => ({ ...current, positions: current.positions.filter((entry) => entry.id !== id) }))
  }, [])

  /** Ogni scheda aperta entra nel bacino da cui nascono le proposte. */
  const rememberPlayer = useCallback((player: Player) => {
    if (!player?.id) return
    setData((current) => {
      const rest = current.seen.filter((entry) => entry.id !== player.id)
      return { ...current, seen: [player, ...rest].slice(0, 60) }
    })
  }, [])

  const addCatalyst = useCallback((raw: Partial<Catalyst> & { title: string }) => {
    const catalyst = normalizeCatalyst({ ...raw, id: raw.id ?? `manuale-${newId()}`, source: 'manuale' })
    setData((current) => ({ ...current, catalysts: [catalyst, ...current.catalysts] }))
  }, [])

  const removeCatalyst = useCallback((id: string) => {
    setData((current) => ({ ...current, catalysts: current.catalysts.filter((entry) => entry.id !== id) }))
  }, [])

  /**
   * Gli avvisi arrivano dalle regole a ogni aggiornamento dei prezzi: si
   * scartano i duplicati per id e si tengono solo gli ultimi 60, così la
   * lista resta leggibile e lo storage non cresce all'infinito.
   * Restituisce i soli avvisi nuovi, per poterli notificare una volta sola.
   */
  const pushAlerts = useCallback((incoming: Alert[]) => {
    if (incoming.length === 0) return []
    let fresh: Alert[] = []
    setData((current) => {
      const known = new Set(current.alerts.map((alert) => alert.id))
      fresh = incoming.filter((alert) => !known.has(alert.id))
      if (fresh.length === 0) return current
      return { ...current, alerts: [...fresh, ...current.alerts].slice(0, 60) }
    })
    return fresh
  }, [])

  const markAlertsRead = useCallback(() => {
    setData((current) => ({ ...current, alerts: current.alerts.map((alert) => ({ ...alert, read: true })) }))
  }, [])

  const removeAlert = useCallback((id: string) => {
    setData((current) => ({ ...current, alerts: current.alerts.filter((alert) => alert.id !== id) }))
  }, [])

  const clearAlerts = useCallback(() => setData((current) => ({ ...current, alerts: [] })), [])

  const replaceAll = useCallback((next: AppData) => setData(next), [])
  const reset = useCallback(() => setData(defaultData), [])

  const value = useMemo<Store>(
    () => ({
      data,
      settings: data.settings,
      updateSettings,
      addWatch,
      updateWatch,
      removeWatch,
      isWatched: (id: string) => data.watchlist.some((entry) => entry.id === id),
      addPosition,
      closePosition,
      reopenPosition,
      removePosition,
      rememberPlayer,
      addCatalyst,
      removeCatalyst,
      pushAlerts,
      markAlertsRead,
      removeAlert,
      clearAlerts,
      replaceAll,
      reset,
    }),
    [
      data,
      updateSettings,
      addWatch,
      updateWatch,
      removeWatch,
      addPosition,
      closePosition,
      reopenPosition,
      removePosition,
      rememberPlayer,
      addCatalyst,
      removeCatalyst,
      pushAlerts,
      markAlertsRead,
      removeAlert,
      clearAlerts,
      replaceAll,
      reset,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
