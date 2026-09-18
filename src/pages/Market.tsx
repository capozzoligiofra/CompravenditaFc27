import { useEffect, useState } from 'react'

import Sparkline from '../components/Sparkline.tsx'
import { Card, CardTitle, EmptyState, Pill, Stat, buttonClass, primaryButtonClass } from '../components/ui.tsx'
import { getPlayer, searchPlayers } from '../lib/api.ts'
import { coins } from '../lib/format.ts'
import { breakEvenSell, maxBuyForMargin, roundToMarketStep, sellForMargin } from '../lib/market.ts'
import { useStore } from '../lib/useStore.ts'
import type { Player, PlayerDetail } from '../types.ts'

const PLATFORM_LABEL = { ps: 'PlayStation', xbox: 'Xbox', pc: 'PC' } as const

export default function Market() {
  const { settings, addWatch, isWatched, addPosition } = useStore()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Player[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Player | null>(null)
  const [detail, setDetail] = useState<PlayerDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  // Ricerca con debounce: una richiesta sola quando l'utente smette di digitare.
  useEffect(() => {
    const term = query.trim()
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setSearching(true)
      searchPlayers(term, controller.signal)
        .then((response) => {
          setResults(response.players)
          setError(response.source === 'demo' && response.reason ? `Sorgente demo: ${response.reason}` : null)
        })
        .catch((cause: unknown) => {
          if (controller.signal.aborted) return
          setError(cause instanceof Error ? cause.message : 'Errore di rete')
          setResults([])
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false)
        })
    }, 350)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  // Il dettaglio si ricarica sia quando cambia il giocatore sia quando cambia
  // la piattaforma scelta nell'intestazione.
  useEffect(() => {
    if (!selected) return undefined
    const controller = new AbortController()
    setLoadingDetail(true)
    getPlayer(selected.id, settings.platform, controller.signal)
      .then(setDetail)
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Errore di rete')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingDetail(false)
      })
    return () => controller.abort()
  }, [selected, settings.platform])

  const quote = detail?.prices?.[settings.platform] ?? null
  const price = quote?.price ?? 0
  const maxBuy = price ? roundToMarketStep(maxBuyForMargin(price, settings.targetMarginPercent, settings.taxPercent)) : 0
  const suggestedSell = price ? sellForMargin(price, settings.targetMarginPercent, settings.taxPercent) : 0

  return (
    <div className="space-y-5">
      <Card>
        <CardTitle hint="Cerca per nome, club, nazione o ruolo. I prezzi arrivano da Futbin tramite il proxy locale.">
          Cerca un giocatore
        </CardTitle>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Es. Lautaro, Inter, Serie A…"
          className="w-full rounded-xl border border-pitch-line bg-pitch px-4 py-3 text-base outline-none placeholder:text-chalk-dim/60 focus:border-gain/60"
        />
        {error ? <p className="mt-2 text-xs text-flag">{error}</p> : null}
        {searching ? <p className="mt-2 text-xs text-chalk-dim">ricerca in corso…</p> : null}

        <ul className="mt-3 divide-y divide-pitch-line">
          {results.map((player) => (
            <li key={player.id}>
              <button
                type="button"
                onClick={() => setSelected(player)}
                className={`flex w-full items-center gap-3 px-1 py-2.5 text-left transition hover:bg-pitch/60 ${
                  selected?.id === player.id ? 'bg-pitch/60' : ''
                }`}
              >
                <span className="w-9 shrink-0 rounded-lg bg-flag/15 py-1 text-center font-mono text-sm font-bold text-flag">
                  {player.rating || '—'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{player.name}</span>
                  <span className="block truncate text-xs text-chalk-dim">
                    {player.position} · {player.club} · {player.nation}
                  </span>
                </span>
                {isWatched(player.id) ? <Pill tone="gain">in lista</Pill> : null}
              </button>
            </li>
          ))}
        </ul>

        {!searching && results.length === 0 ? (
          <p className="mt-3 text-sm text-chalk-dim">Nessun risultato: prova con un altro nome.</p>
        ) : null}
      </Card>

      {selected ? (
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">{selected.name}</h2>
              <p className="text-xs text-chalk-dim">
                {selected.rating || '—'} · {selected.position} · {selected.club} · {selected.version}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Pill tone={detail?.source === 'futbin' ? 'gain' : 'flag'}>
                {detail?.source === 'futbin' ? 'Futbin' : 'demo'}
              </Pill>
              <Pill>{PLATFORM_LABEL[settings.platform]}</Pill>
            </div>
          </div>

          {loadingDetail ? (
            <p className="mt-4 text-sm text-chalk-dim">caricamento prezzi…</p>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="Prezzo attuale" value={coins(price)} hint={quote?.updated} />
                <Stat label="Min 24h" value={coins(quote?.minPrice ?? 0)} />
                <Stat label="Max 24h" value={coins(quote?.maxPrice ?? 0)} />
                <Stat
                  label="Variazione"
                  value={quote?.changePercent ? `${quote.changePercent > 0 ? '+' : ''}${quote.changePercent}%` : '—'}
                  tone={(quote?.changePercent ?? 0) > 0 ? 'gain' : (quote?.changePercent ?? 0) < 0 ? 'loss' : 'neutral'}
                />
              </div>

              <div className="mt-4">
                <Sparkline points={detail?.history ?? []} />
              </div>

              <div className="mt-5 rounded-xl border border-gain/25 bg-gain/5 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-gain">
                  Piano di trade · margine {settings.targetMarginPercent}%
                </h3>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Stat label="Compra entro" value={coins(maxBuy)} hint="da usare come BIN massimo nel filtro" />
                  <Stat label="Rivendi a" value={coins(suggestedSell)} hint={`tassa ${settings.taxPercent}% inclusa`} />
                  <Stat
                    label="Pareggio"
                    value={coins(breakEvenSell(price, settings.taxPercent))}
                    hint="sotto questo prezzo ci rimetti"
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={primaryButtonClass}
                  disabled={isWatched(selected.id)}
                  onClick={() =>
                    addWatch({
                      id: selected.id,
                      name: selected.name,
                      rating: selected.rating,
                      position: selected.position,
                      club: selected.club,
                      buyTarget: maxBuy,
                      sellTarget: suggestedSell,
                      note: '',
                    })
                  }
                >
                  {isWatched(selected.id) ? 'Già in watchlist' : 'Aggiungi alla watchlist'}
                </button>
                <button
                  type="button"
                  className={buttonClass}
                  disabled={!price}
                  onClick={() =>
                    addPosition({
                      playerId: selected.id,
                      name: selected.name,
                      rating: selected.rating,
                      quantity: 1,
                      buyPrice: price,
                      platform: settings.platform,
                      note: 'aggiunto dal mercato',
                    })
                  }
                >
                  Registra acquisto a {coins(price)}
                </button>
              </div>

              {detail?.reason ? <p className="mt-3 text-[11px] text-chalk-dim">Nota sorgente: {detail.reason}</p> : null}
            </>
          )}
        </Card>
      ) : (
        <EmptyState title="Nessun giocatore selezionato">
          Cerca un nome qui sopra per vedere prezzo, storico e il piano di acquisto/rivendita calcolato sul tuo
          margine obiettivo.
        </EmptyState>
      )}
    </div>
  )
}
