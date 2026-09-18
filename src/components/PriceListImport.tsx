import { useMemo, useState } from 'react'

import { matchKnownPlayer, parsePriceList } from '../../shared/roster-import.mjs'
import { useStore } from '../lib/useStore.ts'
import { Card, CardTitle, primaryButtonClass } from './ui.tsx'

/**
 * Aggiornamento dei prezzi in blocco. Quando la sorgente automatica è chiusa,
 * scrivere venti prezzi uno alla volta è il vero ostacolo: qui se ne incolla
 * un elenco e si sistemano tutti insieme.
 *
 * I nomi si cercano fra i giocatori che l'app già conosce (watchlist, rosa,
 * schede aperte): nessuna richiesta di rete, funziona anche offline.
 */
export default function PriceListImport() {
  const { data, setManualPrice } = useStore()
  const [text, setText] = useState('')
  const [report, setReport] = useState<string | null>(null)

  const conosciuti = useMemo(() => {
    const byId = new Map<string, { id: string; name: string; rating: number }>()
    for (const player of data.seen) byId.set(player.id, player)
    for (const item of data.watchlist) {
      if (!byId.has(item.id)) byId.set(item.id, { id: item.id, name: item.name, rating: item.rating })
    }
    for (const position of data.positions) {
      if (position.playerId && !byId.has(position.playerId)) {
        byId.set(position.playerId, { id: position.playerId, name: position.name, rating: position.rating })
      }
    }
    return [...byId.values()]
  }, [data.seen, data.watchlist, data.positions])

  const righe = parsePriceList(text)

  const applica = () => {
    let aggiornati = 0
    const mancanti: string[] = []
    for (const riga of righe) {
      const player = matchKnownPlayer(riga.name, conosciuti)
      if (player) {
        setManualPrice(player.id, riga.price)
        aggiornati += 1
      } else {
        mancanti.push(riga.name)
      }
    }
    setText('')
    setReport(
      mancanti.length > 0
        ? `${aggiornati} prezzi aggiornati. Non trovati: ${mancanti.join(', ')} — aprili una volta dal Mercato e riprova.`
        : `${aggiornati} prezzi aggiornati.`,
    )
  }

  return (
    <Card>
      <CardTitle hint="Una riga per carta: nome e prezzo. Serve quando i prezzi automatici non arrivano.">
        Aggiorna i prezzi in blocco
      </CardTitle>
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={4}
        placeholder={'Lautaro Martinez 150k\nBastoni 44000\nRafael Leao 58000'}
        className="w-full rounded-xl border border-pitch-line bg-pitch px-3 py-2 font-mono text-sm outline-none focus:border-gain/60"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" className={primaryButtonClass} disabled={righe.length === 0} onClick={applica}>
          Aggiorna {righe.length || ''} prezzi
        </button>
        <span className="text-xs text-chalk-dim">
          {conosciuti.length} giocatori conosciuti dall'app
        </span>
      </div>
      {report ? <p className="mt-2 text-xs text-gain">{report}</p> : null}
    </Card>
  )
}
