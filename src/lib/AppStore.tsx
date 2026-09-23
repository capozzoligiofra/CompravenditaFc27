import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import type { Catalyst } from '../../shared/catalysts.d.mts'
import { normalizeCatalyst } from '../../shared/catalysts.mjs'
import { needsSnapshot, recordSnapshot } from '../../shared/history.mjs'
import { localiSuperati, prezziEffettivi } from '../../shared/sync.mjs'
import type { PrezzoCondiviso } from '../../shared/sync.d.mts'
import type { DatiPersonali } from './cloud.ts'
import { leggiAccount, salvaAccount, type Account } from './cloud.ts'
import type { Alert, AppData, HistoryPoint, Player, Position, Quote, Settings, WatchItem } from '../types.ts'
import { defaultData, loadData, saveData } from './storage.ts'

export interface Store {
  data: AppData
  settings: Settings
  /**
   * I prezzi che l'app usa davvero: il listino comune e quelli che hai
   * scritto tu, fusi tenendo il più recente per ogni carta.
   */
  prezzi: Record<string, PrezzoCondiviso>
  /** Chi sei sul listino condiviso, se ti sei collegato. */
  account: Account | null
  setAccount: (account: Account | null) => void
  /** Sostituisce il listino comune con quello appena sincronizzato. */
  impostaPrezziCondivisi: (
    condivisi: Record<string, PrezzoCondiviso>,
    syncedAt: number,
    piattaforma: Settings['platform'],
  ) => void
  /** Sostituisce i dati personali con quelli arrivati dal server. */
  applicaDatiRemoti: (contenuto: DatiPersonali, aggiornato: number) => void
  /** Annota che i dati personali sono cambiati (o appena inviati). */
  segnaDatiCambiati: (quando: number) => void
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
  setManualPrice: (playerId: string, price: number) => void
  clearManualPrices: () => void
  recordPrices: (quotes: Record<string, Quote | null>) => void
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
  // L'account sta fuori dai dati dell'app di proposito: il token non deve
  // finire nei backup JSON che ci si scambia.
  const [account, setAccountState] = useState<Account | null>(() => leggiAccount())

  const setAccount = useCallback((prossimo: Account | null) => {
    salvaAccount(prossimo)
    setAccountState(prossimo)
  }, [])

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

  /** Prezzo letto in gioco e scritto a mano: vale finché non arriva quello vero. */
  const setManualPrice = useCallback((playerId: string, price: number) => {
    if (!playerId) return
    setData((current) => {
      const next = { ...current.manualPrices }
      if (price > 0) next[playerId] = { price: Math.round(price), at: Date.now() }
      else delete next[playerId]
      return { ...current, manualPrices: next }
    })
  }, [])

  const clearManualPrices = useCallback(() => setData((current) => ({ ...current, manualPrices: {} })), [])

  /**
   * Il listino comune appena arrivato. I prezzi tuoi che il listino ha ormai
   * assorbito si buttano: tenerne due copie identiche non serve, e si
   * finirebbe per rispedirli in eterno.
   */
  const impostaPrezziCondivisi = useCallback(
    (condivisi: Record<string, PrezzoCondiviso>, syncedAt: number, piattaforma: Settings['platform']) => {
      setData((current) => {
        const superati = localiSuperati(current.manualPrices, condivisi)
        const uguale =
          current.sharedPrices === condivisi &&
          syncedAt === current.syncedAt &&
          piattaforma === current.syncedPlatform &&
          superati.length === 0
        if (uguale) return current
        const manualPrices = { ...current.manualPrices }
        for (const id of superati) delete manualPrices[id]
        return { ...current, sharedPrices: condivisi, syncedAt, syncedPlatform: piattaforma, manualPrices }
      })
    },
    [],
  )

  const applicaDatiRemoti = useCallback((contenuto: DatiPersonali, aggiornato: number) => {
    setData((current) => ({
      ...current,
      settings: { ...current.settings, ...(contenuto.settings ?? {}) },
      watchlist: Array.isArray(contenuto.watchlist) ? contenuto.watchlist : current.watchlist,
      positions: Array.isArray(contenuto.positions) ? contenuto.positions : current.positions,
      catalysts: Array.isArray(contenuto.catalysts) ? contenuto.catalysts : current.catalysts,
      seen: Array.isArray(contenuto.seen) ? contenuto.seen : current.seen,
      dataChangedAt: aggiornato,
    }))
  }, [])

  const segnaDatiCambiati = useCallback((quando: number) => {
    setData((current) => (current.dataChangedAt === quando ? current : { ...current, dataChangedAt: quando }))
  }, [])

  /**
   * Annota i prezzi visti, uno al giorno per carta: è lo storico su cui si
   * basano i segnali quando nessuna sorgente lo fornisce. Scrive solo se
   * qualcosa è davvero cambiato, altrimenti si innescherebbe un ciclo.
   */
  const recordPrices = useCallback((quotes: Record<string, Quote | null>) => {
    setData((current) => {
      const now = Date.now()
      let cambiato = false
      const next: Record<string, HistoryPoint[]> = { ...current.priceHistory }
      for (const [id, quote] of Object.entries(quotes)) {
        const price = quote?.price ?? 0
        if (!needsSnapshot(next[id] ?? [], price, now)) continue
        next[id] = recordSnapshot(next[id] ?? [], price, now)
        cambiato = true
      }
      return cambiato ? { ...current, priceHistory: next } : current
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

  // Il listino scaricato vale per la piattaforma di allora: se l'hai appena
  // cambiata non si mostrano prezzi PlayStation a chi gioca su Xbox, si
  // aspetta la sincronizzazione.
  const prezzi = useMemo(() => {
    const comune = data.syncedPlatform === data.settings.platform ? data.sharedPrices : {}
    return prezziEffettivi(data.manualPrices, comune) as Record<string, PrezzoCondiviso>
  }, [data.manualPrices, data.sharedPrices, data.syncedPlatform, data.settings.platform])

  const value = useMemo<Store>(
    () => ({
      data,
      settings: data.settings,
      prezzi,
      account,
      setAccount,
      impostaPrezziCondivisi,
      applicaDatiRemoti,
      segnaDatiCambiati,
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
      setManualPrice,
      clearManualPrices,
      recordPrices,
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
      prezzi,
      account,
      setAccount,
      impostaPrezziCondivisi,
      applicaDatiRemoti,
      segnaDatiCambiati,
      updateSettings,
      addWatch,
      updateWatch,
      removeWatch,
      addPosition,
      closePosition,
      reopenPosition,
      removePosition,
      rememberPlayer,
      setManualPrice,
      clearManualPrices,
      recordPrices,
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
