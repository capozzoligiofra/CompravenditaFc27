import { useEffect, useState } from 'react'

import { useNavigate } from 'react-router-dom'

import { Card, CardTitle, EmptyState, Pill } from '../components/ui.tsx'
import { searchPlayers } from '../lib/api.ts'
import { coins } from '../lib/format.ts'
import { useStore } from '../lib/useStore.ts'
import type { Player } from '../types.ts'

/**
 * Il Mercato è la porta d'ingresso per le carte nuove: si cerca un nome e si
 * apre la sua scheda. La scheda è una sola per tutta l'app — quella che si
 * apre anche cliccando un nome nel pannello dei prezzi, in watchlist o in
 * rosa — così quello che si può fare su una carta è sempre nello stesso posto.
 */
export default function Market() {
  const { data, prezzi, isWatched, rememberPlayer } = useStore()
  const naviga = useNavigate()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Player[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Ricerca con debounce: una richiesta sola quando l'utente smette di
  // digitare, e nessuna finché non ci sono almeno due lettere.
  useEffect(() => {
    const term = query.trim()
    if (term.length < 2) {
      setResults([])
      setSearching(false)
      return undefined
    }
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

  const apri = (player: Player) => {
    rememberPlayer(player)
    naviga(`/carta/${encodeURIComponent(player.id)}`)
  }

  // Le ultime carte aperte: quasi sempre si torna su quelle.
  const recenti = data.seen.slice(0, 8)

  return (
    <div className="space-y-5">
      <Card>
        <CardTitle hint="Cerca per nome, club, nazione o ruolo. Aprendo una carta entra fra quelle che segui.">
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
                onClick={() => apri(player)}
                className="flex w-full items-center gap-3 px-1 py-2.5 text-left transition hover:bg-pitch/60"
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
                {prezzi[player.id]?.price ? (
                  <span className="font-mono text-sm">{coins(prezzi[player.id].price)}</span>
                ) : null}
                {isWatched(player.id) ? <Pill tone="gain">in lista</Pill> : null}
              </button>
            </li>
          ))}
        </ul>

        {query.trim().length >= 2 && !searching && results.length === 0 ? (
          <p className="mt-3 text-sm text-chalk-dim">Nessun risultato: prova con un altro nome.</p>
        ) : null}
      </Card>

      {recenti.length > 0 ? (
        <Card>
          <CardTitle hint="Le ultime che hai aperto: un tocco per tornarci.">Carte recenti</CardTitle>
          <ul className="divide-y divide-pitch-line">
            {recenti.map((player) => (
              <li key={player.id}>
                <button
                  type="button"
                  onClick={() => apri(player)}
                  className="flex w-full items-center gap-3 px-1 py-2.5 text-left transition hover:bg-pitch/60"
                >
                  <span className="w-9 shrink-0 text-center font-mono text-xs text-chalk-dim">
                    {player.rating || '—'}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">{player.name}</span>
                  {prezzi[player.id]?.price ? (
                    <span className="font-mono text-xs text-chalk-dim">{coins(prezzi[player.id].price)}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </Card>
      ) : (
        <EmptyState title="Nessuna carta aperta finora">
          Cerca un nome qui sopra: nella scheda trovi prezzo, storico, stima e il piano di acquisto e rivendita
          calcolato sul tuo margine.
        </EmptyState>
      )}
    </div>
  )
}
