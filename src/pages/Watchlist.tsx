import { useCallback, useEffect, useMemo, useState } from 'react'

import { Card, CardTitle, Delta, EmptyState, NumberField, Pill, Stat, buttonClass } from '../components/ui.tsx'
import { mergeQuotes } from '../../shared/quotes.mjs'
import { getQuotes } from '../lib/api.ts'
import { coins, dateTime } from '../lib/format.ts'
import { profit, signalFor, type Signal } from '../../shared/market.mjs'
import { useStore } from '../lib/useStore.ts'
import type { Quote } from '../types.ts'

const SIGNAL_TONE: Record<Signal, 'gain' | 'loss' | 'flag' | 'neutral'> = {
  compra: 'gain',
  vendi: 'loss',
  attendi: 'flag',
  'nessun-target': 'neutral',
}

const SIGNAL_LABEL: Record<Signal, string> = {
  compra: 'compra ora',
  vendi: 'vendi ora',
  attendi: 'attendi',
  'nessun-target': 'imposta target',
}

export default function Watchlist() {
  const { data, settings, updateWatch, removeWatch } = useStore()
  const [liveQuotes, setLiveQuotes] = useState<Record<string, Quote | null>>({})
  const [source, setSource] = useState<'futbin' | 'demo'>('demo')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  const [fromCache, setFromCache] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)

  const ids = data.watchlist.map((item) => item.id).join(',')

  const refresh = useCallback(
    (signal?: AbortSignal) => {
      const list = ids ? ids.split(',') : []
      if (list.length === 0) return
      setLoading(true)
      getQuotes(list, settings.platform, signal)
        .then((response) => {
          setLiveQuotes(response.quotes)
          setSource(response.source)
          setUpdatedAt(Date.now())
          setFromCache(response.fromCache === true)
          setError(null)
        })
        .catch((cause: unknown) => {
          if (signal?.aborted) return
          setError(cause instanceof Error ? cause.message : 'Errore di rete')
        })
        .finally(() => {
          if (!signal?.aborted) setLoading(false)
        })
    },
    [ids, settings.platform],
  )

  useEffect(() => {
    const controller = new AbortController()
    refresh(controller.signal)
    return () => controller.abort()
  }, [refresh])

  const quotes = useMemo(
    () => mergeQuotes(liveQuotes, data.manualPrices, source) as Record<string, Quote | null>,
    [liveQuotes, data.manualPrices, source],
  )

  const buySignals = data.watchlist.filter(
    (item) => signalFor(quotes[item.id]?.price ?? 0, item.buyTarget, item.sellTarget) === 'compra',
  ).length
  const sellSignals = data.watchlist.filter(
    (item) => signalFor(quotes[item.id]?.price ?? 0, item.buyTarget, item.sellTarget) === 'vendi',
  ).length

  if (data.watchlist.length === 0) {
    return (
      <EmptyState title="Watchlist vuota">
        Dalla pagina <strong>Mercato</strong> cerca un giocatore e premi «Aggiungi alla watchlist»: qui vedrai il
        prezzo aggiornato e il segnale di acquisto o vendita rispetto ai tuoi target.
      </EmptyState>
    )
  }

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle
            hint={
              fromCache
                ? 'Telefono offline: prezzi salvati in memoria, non aggiornati.'
                : updatedAt
                  ? `Ultimo aggiornamento: ${dateTime(updatedAt)}`
                  : 'Prezzi non ancora caricati'
            }
          >
            Segnali attivi {fromCache ? <Pill tone="flag">offline</Pill> : null}
          </CardTitle>
          <button type="button" className={buttonClass} onClick={() => refresh()} disabled={loading}>
            {loading ? 'aggiorno…' : 'Aggiorna prezzi'}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="In lista" value={String(data.watchlist.length)} />
          <Stat label="Da comprare" value={String(buySignals)} tone={buySignals ? 'gain' : 'neutral'} />
          <Stat label="Da vendere" value={String(sellSignals)} tone={sellSignals ? 'loss' : 'neutral'} />
        </div>
        {error ? <p className="mt-2 text-xs text-flag">{error}</p> : null}
      </Card>

      <ul className="space-y-3">
        {data.watchlist.map((item) => {
          const quote = quotes[item.id] ?? null
          const price = quote?.price ?? 0
          const signal = signalFor(price, item.buyTarget, item.sellTarget)
          const potential = price && item.sellTarget ? profit(price, item.sellTarget, settings.taxPercent) : 0
          const open = editing === item.id

          return (
            <li key={item.id}>
              <Card>
                <div className="flex flex-wrap items-start gap-3">
                  <span className="w-9 shrink-0 rounded-lg bg-flag/15 py-1 text-center font-mono text-sm font-bold text-flag">
                    {item.rating || '—'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{item.name}</p>
                    <p className="truncate text-xs text-chalk-dim">
                      {item.position} · {item.club}
                    </p>
                  </div>
                  <Pill tone={SIGNAL_TONE[signal]}>{SIGNAL_LABEL[signal]}</Pill>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Stat label="Prezzo" value={coins(price)} hint={quote?.updated} />
                  <Stat label="Target acquisto" value={coins(item.buyTarget)} />
                  <Stat label="Target vendita" value={coins(item.sellTarget)} />
                  <Stat
                    label="Profitto se compri ora"
                    value={potential ? coins(potential) : '—'}
                    tone={potential > 0 ? 'gain' : potential < 0 ? 'loss' : 'neutral'}
                    hint="al netto della tassa"
                  />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-chalk-dim">
                  <span>
                    variazione <Delta value={quote?.changePercent ?? 0} />
                  </span>
                  <button type="button" className={buttonClass} onClick={() => setEditing(open ? null : item.id)}>
                    {open ? 'Chiudi' : 'Modifica target'}
                  </button>
                  <button type="button" className={buttonClass} onClick={() => removeWatch(item.id)}>
                    Rimuovi
                  </button>
                </div>

                {open ? (
                  <div className="mt-3 grid grid-cols-1 gap-3 border-t border-pitch-line pt-3 sm:grid-cols-2">
                    <NumberField
                      label="Compra sotto"
                      value={item.buyTarget}
                      step={100}
                      onChange={(value) => updateWatch(item.id, { buyTarget: value })}
                    />
                    <NumberField
                      label="Vendi sopra"
                      value={item.sellTarget}
                      step={100}
                      onChange={(value) => updateWatch(item.id, { sellTarget: value })}
                    />
                    <label className="sm:col-span-2">
                      <span className="text-[11px] uppercase tracking-[0.14em] text-chalk-dim">Nota</span>
                      <input
                        value={item.note}
                        onChange={(event) => updateWatch(item.id, { note: event.target.value })}
                        placeholder="Es. investimento SBC di fine settimana"
                        className="mt-1 w-full rounded-xl border border-pitch-line bg-pitch px-3 py-2 text-sm outline-none focus:border-gain/60"
                      />
                    </label>
                  </div>
                ) : null}

                {item.note && !open ? <p className="mt-2 text-xs text-chalk-dim">“{item.note}”</p> : null}
              </Card>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
