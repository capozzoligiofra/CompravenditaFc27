import { useNavigate } from 'react-router-dom'

import CardSearch from '../components/CardSearch.tsx'
import { Card, CardTitle, EmptyState } from '../components/ui.tsx'
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
  const { data, prezzi, rememberPlayer } = useStore()
  const naviga = useNavigate()

  const apri = (player: Player) => {
    rememberPlayer(player)
    naviga(`/carta/${encodeURIComponent(player.id)}`)
  }

  // Le ultime carte aperte: quasi sempre si torna su quelle.
  const recenti = data.seen.slice(0, 8)

  return (
    <div className="space-y-5">
      <Card>
        <CardTitle hint="Cerca fra le carte del listino e fra le tue. Se non c'è, creala: nome e valutazione bastano.">
          Cerca un giocatore
        </CardTitle>
        <CardSearch onScegli={apri} etichettaAzione="apri" />
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
