import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import type { Catalyst } from '../../shared/catalysts.d.mts'
import { normalizeCatalyst } from '../../shared/catalysts.mjs'
import { needsSnapshot, recordSnapshot } from '../../shared/history.mjs'
import { applicaUnioni } from '../../shared/duplicates.mjs'
import type { Unione } from '../../shared/duplicates.d.mts'
import { localiSuperati, prezziEffettivi } from '../../shared/sync.mjs'
import type { PrezzoCondiviso } from '../../shared/sync.d.mts'
import type { CartaBase } from '../../shared/catalog.d.mts'
import { leggiCatalogo, salvaCatalogo, type Catalogo, type EsitoSalvataggio } from './catalogStore.ts'
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
  /**
   * Tutte le carte che l'app sa nominare: il catalogo caricato da un file più
   * quelle del listino. Serve a cercare e a riconoscere i nomi, non è
   * l'elenco delle carte che segui.
   */
  catalogo: Catalogo
  /** Aggiunge carte al catalogo, dicendo quanto dettaglio è stato possibile tenere. */
  aggiungiAlCatalogo: (carte: CartaBase[]) => { aggiunte: number } & EsitoSalvataggio
  svuotaCatalogo: () => void
  /** Chi sei sul listino condiviso, se ti sei collegato. */
  account: Account | null
  setAccount: (account: Account | null) => void
  /** Sostituisce il listino comune con quello appena sincronizzato. */
  impostaPrezziCondivisi: (
    condivisi: Record<string, PrezzoCondiviso>,
    syncedAt: number,
    piattaforma: Settings['platform'],
    carte?: Record<string, { name: string; rating: number }>,
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
  /** Applica un elenco intero di prezzi in un colpo solo, creando le carte che mancano. */
  importaPrezzi: (voci: { player: Player; price: number }[]) => void
  clearManualPrices: () => void
  /** Butta la copia locale del listino: prezzi e carte scaricati dal server. */
  dimenticaListino: () => void
  /** I prezzi appena letti dalla sorgente automatica del server. */
  impostaPrezziSorgente: (
    prezzi: Record<string, { price: number; at: number }>,
    carte: Record<string, { name: string; rating: number }>,
  ) => void
  /** Fonde i doppioni: la carta senza valutazione sparisce dentro quella buona. */
  unisciDoppioni: (unioni: Unione[]) => number
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

  const [catalogo, setCatalogo] = useState<Catalogo>(() => leggiCatalogo())

  const aggiungiAlCatalogo = useCallback((carte: CartaBase[]) => {
    let aggiunte = 0
    let esito: EsitoSalvataggio = { salvato: true, dettaglio: 'completo' }
    setCatalogo((current) => {
      const prossimo = { ...current }
      let cambiato = false
      for (const carta of carte) {
        if (!carta?.id || !carta.name) continue
        if (!prossimo[carta.id]) aggiunte += 1
        // Anche una carta già presente può arrivare più completa di prima.
        if (!prossimo[carta.id] || JSON.stringify(prossimo[carta.id]) !== JSON.stringify(carta)) cambiato = true
        prossimo[carta.id] = carta
      }
      if (!cambiato) return current
      esito = salvaCatalogo(prossimo)
      return prossimo
    })
    return { aggiunte, ...esito }
  }, [])

  const svuotaCatalogo = useCallback(() => {
    setCatalogo({})
    salvaCatalogo({})
  }, [])

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
      const adesso = Date.now()
      if (price > 0) next[playerId] = { price: Math.round(price), at: adesso }
      else delete next[playerId]
      // Il punto di storia nasce qui, quando il prezzo viene osservato, e non
      // ogni volta che l'app lo rilegge: un prezzo di tre giorni fa non deve
      // diventare «segnato oggi» solo perché hai aperto l'app.
      const priceHistory =
        price > 0 && needsSnapshot(current.priceHistory[playerId] ?? [], price, adesso)
          ? { ...current.priceHistory, [playerId]: recordSnapshot(current.priceHistory[playerId] ?? [], price, adesso) }
          : current.priceHistory
      return { ...current, manualPrices: next, priceHistory }
    })
  }, [])

  /**
   * Un elenco incollato può valere centinaia di carte: si applica tutto in un
   * aggiornamento solo, altrimenti l'app ridisegna la pagina a ogni riga e il
   * telefono si pianta a metà.
   */
  const importaPrezzi = useCallback((voci: { player: Player; price: number }[]) => {
    if (voci.length === 0) return
    setData((current) => {
      const adesso = Date.now()
      const manualPrices = { ...current.manualPrices }
      const priceHistory = { ...current.priceHistory }
      const perId = new Map(current.seen.map((player) => [player.id, player]))
      for (const { player, price } of voci) {
        if (!player?.id || !(price > 0)) continue
        manualPrices[player.id] = { price: Math.round(price), at: adesso }
        if (needsSnapshot(priceHistory[player.id] ?? [], price, adesso)) {
          priceHistory[player.id] = recordSnapshot(priceHistory[player.id] ?? [], price, adesso)
        }
        // Le carte che non conoscevi entrano fra quelle che segui: le hai
        // appena prezzate, quindi ti interessano.
        const conosciuta = perId.get(player.id)
        if (!conosciuta || (player.name.length > conosciuta.name.length)) perId.set(player.id, { ...conosciuta, ...player })
      }
      return {
        ...current,
        manualPrices,
        priceHistory,
        seen: [...perId.values()].slice(0, 400),
      }
    })
  }, [])

  const clearManualPrices = useCallback(() => setData((current) => ({ ...current, manualPrices: {} })), [])

  /**
   * Dimentica quello che è stato scaricato dal listino: prezzi comuni, carte
   * viste solo lì, e il segnaposto della sincronizzazione. Serve quando il
   * listino sul server è stato svuotato — altrimenti questo dispositivo
   * continuerebbe a mostrare per sempre la sua copia di prezzi che non
   * esistono più. La tua rosa, la watchlist e i prezzi scritti da te restano.
   */
  const dimenticaListino = useCallback(() => {
    setData((current) => ({ ...current, sharedPrices: {}, sharedPlayers: {}, sourcePrices: {}, sourcePlayers: {}, syncedAt: 0 }))
  }, [])

  /**
   * I prezzi della sorgente automatica. Sostituiscono in blocco i precedenti,
   * non si fondono: la sorgente e' una fotografia di adesso, e una carta che
   * ne e' sparita non deve restare a mostrare il prezzo di ieri. I prezzi
   * scritti a mano non si toccano — la sorgente li copre finche' e' piu'
   * fresca, poi tornano a valere da soli.
   */
  const impostaPrezziSorgente = useCallback((
    prezzi: Record<string, { price: number; at: number }>,
    carte: Record<string, { name: string; rating: number }>,
  ) => {
    setData((current) => {
      const adesso = Date.now()
      const priceHistory = { ...current.priceHistory }
      let cambiato = Object.keys(prezzi).length !== Object.keys(current.sourcePrices).length
      for (const [id, voce] of Object.entries(prezzi)) {
        if (current.sourcePrices[id]?.price !== voce.price || current.sourcePrices[id]?.at !== voce.at) cambiato = true
        // Anche questi sono osservazioni, e valgono per lo storico con la
        // data in cui il prezzo e' stato visto, non con quella di adesso.
        const quando = voce.at || adesso
        if (needsSnapshot(priceHistory[id] ?? [], voce.price, quando)) {
          priceHistory[id] = recordSnapshot(priceHistory[id] ?? [], voce.price, quando)
        }
      }
      if (!cambiato) return current
      return { ...current, sourcePrices: prezzi, sourcePlayers: carte, priceHistory }
    })
  }, [])

  /**
   * Fonde i doppioni nei dati di questo dispositivo.
   *
   * Non e' una cancellazione: il prezzo, lo storico, i target della watchlist
   * e le posizioni passano sulla carta buona, e sparisce solo il segnaposto,
   * che non aveva niente di suo oltre al nome. I dati contano come cambiati,
   * cosi' la nuova versione va sul server invece di farsi riportare indietro
   * la vecchia.
   */
  const unisciDoppioni = useCallback((unioni: Unione[]) => {
    if (unioni.length === 0) return 0
    let unite = 0
    setData((current) => {
      const esito = applicaUnioni(current, unioni)
      unite = esito.unite
      if (esito.data === current) return current
      return { ...esito.data, dataChangedAt: Date.now() }
    })
    // Anche dal catalogo, se il segnaposto era finito pure li' (capita con un
    // CSV che elenca lo stesso nome una volta con il voto e una senza). Senza
    // questo passaggio la carta resterebbe fra i doppioni per sempre, e
    // l'app continuerebbe a provare a unirla.
    setCatalogo((current) => {
      const prossimo = { ...current }
      let cambiato = false
      for (const { da } of unioni) {
        if (prossimo[da]) {
          delete prossimo[da]
          cambiato = true
        }
      }
      if (!cambiato) return current
      salvaCatalogo(prossimo)
      return prossimo
    })
    return unite
  }, [])

  /**
   * Il listino comune appena arrivato. I prezzi tuoi che il listino ha ormai
   * assorbito si buttano: tenerne due copie identiche non serve, e si
   * finirebbe per rispedirli in eterno.
   */
  const impostaPrezziCondivisi = useCallback(
    (
      condivisi: Record<string, PrezzoCondiviso>,
      syncedAt: number,
      piattaforma: Settings['platform'],
      carte: Record<string, { name: string; rating: number }> = {},
    ) => {
      setData((current) => {
        const superati = localiSuperati(current.manualPrices, condivisi)
        const nuoveCarte = Object.keys(carte).some((id) => current.sharedPlayers[id]?.name !== carte[id].name)
        const uguale =
          current.sharedPrices === condivisi &&
          syncedAt === current.syncedAt &&
          piattaforma === current.syncedPlatform &&
          superati.length === 0 &&
          !nuoveCarte
        if (uguale) return current
        const manualPrices = { ...current.manualPrices }
        for (const id of superati) delete manualPrices[id]
        // Anche i prezzi degli altri sono osservazioni: entrano nello storico
        // con la data in cui sono stati visti in gioco, non con quella della
        // sincronizzazione.
        const priceHistory = { ...current.priceHistory }
        for (const [id, voce] of Object.entries(condivisi)) {
          const quando = voce.at || syncedAt
          if (needsSnapshot(priceHistory[id] ?? [], voce.price, quando)) {
            priceHistory[id] = recordSnapshot(priceHistory[id] ?? [], voce.price, quando)
          }
        }
        return {
          ...current,
          sharedPrices: condivisi,
          priceHistory,
          sharedPlayers: nuoveCarte ? { ...current.sharedPlayers, ...carte } : current.sharedPlayers,
          syncedAt,
          syncedPlatform: piattaforma,
          manualPrices,
        }
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
        // Un prezzo scritto a mano è già in archivio con la sua data: ri-annotarlo
        // ogni giorno lo farebbe sembrare fresco senza che nessuno l'abbia visto.
        if (quote?.manual) continue
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
    const automatici = data.syncedPlatform === data.settings.platform ? data.sourcePrices : {}
    return prezziEffettivi(data.manualPrices, comune, automatici) as Record<string, PrezzoCondiviso>
  }, [data.manualPrices, data.sharedPrices, data.sourcePrices, data.syncedPlatform, data.settings.platform])

  const value = useMemo<Store>(
    () => ({
      data,
      settings: data.settings,
      prezzi,
      catalogo,
      aggiungiAlCatalogo,
      svuotaCatalogo,
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
      importaPrezzi,
      clearManualPrices,
      dimenticaListino,
      impostaPrezziSorgente,
      unisciDoppioni,
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
      catalogo,
      aggiungiAlCatalogo,
      svuotaCatalogo,
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
      importaPrezzi,
      clearManualPrices,
      dimenticaListino,
      impostaPrezziSorgente,
      unisciDoppioni,
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
