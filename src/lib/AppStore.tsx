import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import type { AppData, Position, Settings, WatchItem } from '../types.ts'
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
      replaceAll,
      reset,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}
