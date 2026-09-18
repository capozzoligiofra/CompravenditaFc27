import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { buildAlerts } from '../../shared/alerts.mjs'
import type { Catalyst } from '../../shared/catalysts.d.mts'
import { currentPhase, upcomingEvents } from '../../shared/calendar.mjs'
import type { CalendarEvent, Phase } from '../../shared/calendar.d.mts'
import { demoRoster } from '../../shared/demo.mjs'
import type { Opportunity, ScoreInput } from '../../shared/scoring.d.mts'
import { rankOpportunities } from '../../shared/scoring.mjs'
import type { Alert, Player, Quote } from '../types.ts'
import { getCatalysts, getPlayer, getQuotes } from './api.ts'
import { notifyAlerts } from './notifications.ts'
import { useStore } from './useStore.ts'

export interface OpportunitiesState {
  loading: boolean
  refining: boolean
  error: string | null
  source: 'futbin' | 'demo' | null
  opportunities: Opportunity[]
  catalysts: Catalyst[]
  catalystsReason: string | null
  phase: Phase
  events: CalendarEvent[]
  refresh: () => void
}

/** Quanti giocatori vale la pena approfondire con lo storico completo. */
const REFINE_TOP = 6

export function useOpportunities(): OpportunitiesState {
  const { data, settings, pushAlerts } = useStore()
  const [loading, setLoading] = useState(true)
  const [refining, setRefining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState<'futbin' | 'demo' | null>(null)
  const [quotes, setQuotes] = useState<Record<string, Quote | null>>({})
  const [histories, setHistories] = useState<Record<string, { t: number; price: number }[]>>({})
  const [remote, setRemote] = useState<Catalyst[]>([])
  const [catalystsReason, setCatalystsReason] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  // Orologio aggiornato ogni cinque minuti: serve a far avanzare i conti alla
  // rovescia e a cambiare fase senza ricaricare la pagina.
  const [clock, setClock] = useState(() => Date.now())
  const notified = useRef(new Set<string>())

  const phase = useMemo(() => currentPhase(new Date(clock)), [clock])
  const events = useMemo(() => upcomingEvents(new Date(clock), 4), [clock])
  const catalysts = useMemo(() => [...data.catalysts, ...remote], [data.catalysts, remote])

  /**
   * Il bacino di partenza: watchlist, carte in magazzino e schede già
   * aperte. Se è troppo scarno si aggiunge il listino demo, che però ha
   * senso solo quando i prezzi arrivano dal dataset demo: con Futbin vero
   * quegli identificativi non vogliono dire niente e vengono scartati.
   */
  const { candidates, seeded } = useMemo(() => {
    const byId = new Map<string, Player>()
    for (const item of data.watchlist) {
      byId.set(item.id, {
        id: item.id,
        name: item.name,
        rating: item.rating,
        position: item.position,
        club: item.club,
        league: '',
        nation: '',
        version: '',
        image: '',
      })
    }
    for (const player of data.seen) byId.set(player.id, player)
    for (const position of data.positions) {
      if (position.playerId && !byId.has(position.playerId)) {
        byId.set(position.playerId, {
          id: position.playerId,
          name: position.name,
          rating: position.rating,
          position: '',
          club: '',
          league: '',
          nation: '',
          version: '',
          image: '',
        })
      }
    }
    const seededIds = new Set<string>()
    if (byId.size < 8) {
      for (const player of demoRoster() as Player[]) {
        if (!byId.has(player.id)) {
          byId.set(player.id, player)
          seededIds.add(player.id)
        }
      }
    }
    return { candidates: [...byId.values()].slice(0, 30), seeded: seededIds }
  }, [data.watchlist, data.seen, data.positions])

  const refresh = useCallback(() => {
    setClock(Date.now())
    setTick((value) => value + 1)
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 5 * 60_000)
    return () => clearInterval(timer)
  }, [])

  // Prezzi di tutti i candidati in una sola richiesta.
  useEffect(() => {
    const controller = new AbortController()
    const ids = candidates.map((player) => player.id)
    setLoading(true)
    getQuotes(ids, settings.platform, controller.signal)
      .then((response) => {
        setQuotes(response.quotes)
        setSource(response.source)
        setError(null)
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return
        setError(cause instanceof Error ? cause.message : 'Errore di rete')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [candidates, settings.platform, tick])

  // SBC e obiettivi dal proxy.
  useEffect(() => {
    const controller = new AbortController()
    getCatalysts(controller.signal)
      .then((response) => {
        setRemote(response.catalysts)
        setCatalystsReason(response.catalysts.length === 0 ? response.reason : null)
      })
      .catch(() => undefined)
    return () => controller.abort()
  }, [tick])

  const visible = useMemo(
    () => (source === 'futbin' ? candidates.filter((player) => !seeded.has(player.id)) : candidates),
    [candidates, seeded, source],
  )

  const opportunities = useMemo(() => {
    const openPositions = new Map(
      data.positions.filter((entry) => entry.sellPrice === null).map((entry) => [entry.playerId, entry]),
    )
    const inputs: ScoreInput[] = visible.map((player) => ({
      player,
      quote: quotes[player.id] ?? null,
      history: histories[player.id] ?? [],
      catalysts,
      phase,
      settings,
      position: openPositions.get(player.id) ?? null,
    }))
    return rankOpportunities(inputs, 12)
  }, [visible, quotes, histories, catalysts, phase, settings, data.positions])

  // Storico solo per i primi della lista: una richiesta per giocatore costa,
  // e per gli altri bastano i segnali del prezzo corrente.
  useEffect(() => {
    const missing = opportunities
      .slice(0, REFINE_TOP)
      .map((opportunity) => opportunity.player.id)
      .filter((id) => !(id in histories))
    if (missing.length === 0) {
      setRefining(false)
      return undefined
    }
    const controller = new AbortController()
    let cancelled = false
    setRefining(true)
    ;(async () => {
      for (const id of missing) {
        if (cancelled) return
        try {
          const detail = await getPlayer(id, settings.platform, controller.signal)
          if (cancelled) return
          setHistories((current) => ({ ...current, [id]: detail.history ?? [] }))
        } catch {
          if (!cancelled) setHistories((current) => ({ ...current, [id]: [] }))
        }
      }
      if (!cancelled) setRefining(false)
    })()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [opportunities, histories, settings.platform])

  // Gli avvisi nascono da prezzi, occasioni e calendario, e vengono
  // notificati una sola volta per sessione.
  useEffect(() => {
    if (loading) return
    const fresh = pushAlerts(
      buildAlerts({
        now: Date.now(),
        quotes,
        watchlist: data.watchlist,
        positions: data.positions,
        opportunities,
        phase,
        events,
        settings,
      }) as Alert[],
    )
    const daNotificare = fresh.filter((alert) => !notified.current.has(alert.id))
    for (const alert of daNotificare) notified.current.add(alert.id)
    if (settings.notifications) void notifyAlerts(daNotificare)
  }, [loading, quotes, opportunities, phase, events, data.watchlist, data.positions, settings, pushAlerts])

  return {
    loading,
    refining,
    error,
    source,
    opportunities,
    catalysts,
    catalystsReason,
    phase,
    events,
    refresh,
  }
}
