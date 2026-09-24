import { useEffect, useMemo, useState } from 'react'

import { Pill, buttonClass, primaryButtonClass } from './ui.tsx'
import { searchPlayers } from '../lib/api.ts'
import { cercaNelListino, registraCarta } from '../lib/cloud.ts'
import { catalogoLocale, cercaCarte, creaCarta } from '../../shared/catalog.mjs'
import type { CartaBase } from '../../shared/catalog.d.mts'
import { coins } from '../lib/format.ts'
import { useStore } from '../lib/useStore.ts'
import type { Player } from '../types.ts'

/**
 * La ricerca delle carte, senza cataloghi finti.
 *
 * Guarda in tre posti, in quest'ordine di merito: una sorgente automatica se
 * mai ce ne sarà una, il catalogo comune del listino (le carte che il gruppo
 * ha già creato), e quelle che conosce questo dispositivo. Se la carta non
 * esiste da nessuna parte, la si crea: nome e valutazione bastano, e da quel
 * momento la trovano anche gli altri.
 */
export default function CardSearch({
  onScegli,
  etichettaAzione = 'Apri',
}: {
  onScegli: (player: Player) => void
  etichettaAzione?: string
}) {
  const { data, prezzi, account } = useStore()
  const [query, setQuery] = useState('')
  const [remoti, setRemoti] = useState<Player[]>([])
  const [cercando, setCercando] = useState(false)
  const [valutazione, setValutazione] = useState('')
  const [creando, setCreando] = useState(false)

  const catalogo = useMemo(
    () =>
      catalogoLocale({
        seen: data.seen,
        watchlist: data.watchlist,
        positions: data.positions,
        condivise: data.sharedPlayers,
      }) as CartaBase[],
    [data.seen, data.watchlist, data.positions, data.sharedPlayers],
  )

  useEffect(() => {
    const testo = query.trim()
    if (testo.length < 2) {
      setRemoti([])
      return undefined
    }
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setCercando(true)
      // Le due ricerche remote non si aspettano a vicenda: quella che arriva
      // si mostra, l'altra si aggiunge quando c'è.
      const richieste = [
        searchPlayers(testo, controller.signal).then((risposta) => risposta.players),
        account
          ? cercaNelListino(account, testo, controller.signal).then((risposta) => risposta.giocatori)
          : Promise.resolve<Player[]>([]),
      ]
      Promise.allSettled(richieste)
        .then((esiti) => {
          if (controller.signal.aborted) return
          const trovati = esiti.flatMap((esito) => (esito.status === 'fulfilled' ? esito.value : []))
          setRemoti(trovati)
        })
        .finally(() => {
          if (!controller.signal.aborted) setCercando(false)
        })
    }, 350)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, account])

  const risultati = useMemo(() => {
    const testo = query.trim()
    if (testo.length < 2) return []
    const mappa = new Map<string, Player>()
    for (const player of remoti) {
      if (player?.id && player.name) mappa.set(String(player.id), player as Player)
    }
    for (const carta of cercaCarte(testo, catalogo) as CartaBase[]) {
      if (!mappa.has(carta.id)) mappa.set(carta.id, carta as Player)
    }
    return [...mappa.values()].slice(0, 12)
  }, [remoti, catalogo, query])

  const crea = () => {
    const carta = creaCarta({ name: query, rating: Number(valutazione) || 0 }) as Player | null
    if (!carta) return
    setCreando(true)
    // Nel catalogo comune entra subito, anche prima di avere un prezzo: chi la
    // sta cercando adesso è chi la sta creando, e gli altri devono trovarla.
    if (account) void registraCarta(account, carta).catch(() => undefined)
    setQuery('')
    setValutazione('')
    setRemoti([])
    setCreando(false)
    onScegli(carta)
  }

  const testo = query.trim()
  const nomeGiaPresente = risultati.some((player) => player.name.toLowerCase() === testo.toLowerCase())

  return (
    <div>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Nome del giocatore"
        className="w-full rounded-xl border border-pitch-line bg-pitch px-4 py-3 text-base outline-none placeholder:text-chalk-dim/60 focus:border-gain/60"
      />
      {cercando ? <p className="mt-2 text-xs text-chalk-dim">cerco…</p> : null}

      {risultati.length > 0 ? (
        <ul className="mt-3 divide-y divide-pitch-line">
          {risultati.map((player) => (
            <li key={player.id}>
              <button
                type="button"
                onClick={() => onScegli(player)}
                className="flex w-full items-center gap-3 px-1 py-2.5 text-left transition hover:bg-pitch/60"
              >
                <span className="w-9 shrink-0 rounded-lg bg-flag/15 py-1 text-center font-mono text-sm font-bold text-flag">
                  {player.rating || '—'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{player.name}</span>
                  {player.club || player.position ? (
                    <span className="block truncate text-xs text-chalk-dim">
                      {[player.position, player.club, player.nation].filter(Boolean).join(' · ')}
                    </span>
                  ) : null}
                </span>
                {prezzi[player.id]?.price ? (
                  <span className="font-mono text-sm">{coins(prezzi[player.id].price)}</span>
                ) : (
                  <Pill>{etichettaAzione}</Pill>
                )}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {testo.length >= 2 && !nomeGiaPresente ? (
        <div className="mt-3 rounded-xl border border-pitch-line bg-pitch/60 p-3">
          <p className="text-xs text-chalk-dim">
            {risultati.length === 0 ? 'Nessuna carta con questo nome.' : 'Non è fra queste?'} Creala: basta nome e
            valutazione, e la trovano anche gli altri del listino.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{testo}</span>
            <input
              value={valutazione}
              onChange={(event) => setValutazione(event.target.value.replace(/[^\d]/g, '').slice(0, 2))}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && valutazione) crea()
              }}
              inputMode="numeric"
              placeholder="val."
              aria-label="Valutazione"
              className="w-16 rounded-xl border border-pitch-line bg-pitch px-2 py-2 text-center font-mono text-sm outline-none focus:border-gain/60"
            />
            <button type="button" className={primaryButtonClass} onClick={crea} disabled={creando}>
              Crea la carta
            </button>
          </div>
          <p className="mt-2 text-[11px] text-chalk-dim">
            Scrivi il nome come lo leggi in gioco: chi lo scriverà uguale ritroverà la stessa carta, non un doppione. La
            valutazione puoi anche lasciarla vuota e scriverla dopo, dalla scheda.
          </p>
        </div>
      ) : null}

      {testo.length > 0 && testo.length < 2 ? (
        <p className="mt-2 text-xs text-chalk-dim">Scrivi almeno due lettere.</p>
      ) : null}
    </div>
  )
}

export { buttonClass }
