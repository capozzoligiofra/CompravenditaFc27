import { useEffect, useMemo, useState } from 'react'

import { Card, CardTitle, EmptyState, NumberField, Pill, Stat, buttonClass, primaryButtonClass } from '../components/ui.tsx'
import { getQuotes } from '../lib/api.ts'
import { coins, dateTime, percent, signedCoins } from '../lib/format.ts'
import { profit, roiPercent } from '../../shared/market.mjs'
import { useStore } from '../lib/useStore.ts'
import type { Quote } from '../types.ts'

function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n')
}

export default function Portfolio() {
  const { data, settings, addPosition, closePosition, reopenPosition, removePosition } = useStore()
  const [name, setName] = useState('')
  const [buyPrice, setBuyPrice] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [quotes, setQuotes] = useState<Record<string, Quote | null>>({})
  const [sellDrafts, setSellDrafts] = useState<Record<string, number>>({})

  const open = useMemo(() => data.positions.filter((position) => position.sellPrice === null), [data.positions])
  const closed = useMemo(() => data.positions.filter((position) => position.sellPrice !== null), [data.positions])

  const trackedIds = useMemo(
    () => [...new Set(open.map((position) => position.playerId).filter(Boolean))].join(','),
    [open],
  )

  // Per le posizioni aperte con un giocatore collegato mostriamo anche il
  // valore corrente di mercato, così il P&L latente è reale e non stimato.
  useEffect(() => {
    const ids = trackedIds ? trackedIds.split(',') : []
    if (ids.length === 0) return undefined
    const controller = new AbortController()
    getQuotes(ids, settings.platform, controller.signal)
      .then((response) => setQuotes(response.quotes))
      .catch(() => undefined)
    return () => controller.abort()
  }, [trackedIds, settings.platform])

  const invested = open.reduce((total, position) => total + position.buyPrice * position.quantity, 0)
  const realized = closed.reduce(
    (total, position) => total + profit(position.buyPrice, position.sellPrice ?? 0, settings.taxPercent) * position.quantity,
    0,
  )
  const unrealized = open.reduce((total, position) => {
    const market = quotes[position.playerId]?.price ?? 0
    if (!market) return total
    return total + profit(position.buyPrice, market, settings.taxPercent) * position.quantity
  }, 0)
  const wins = closed.filter(
    (position) => profit(position.buyPrice, position.sellPrice ?? 0, settings.taxPercent) > 0,
  ).length
  const winRate = closed.length ? (wins / closed.length) * 100 : 0

  const exportCsv = () => {
    const rows = [
      ['giocatore', 'quantita', 'acquisto', 'vendita', 'profitto_netto', 'stato', 'data_acquisto', 'data_vendita'],
      ...data.positions.map((position) => [
        position.name,
        String(position.quantity),
        String(position.buyPrice),
        position.sellPrice === null ? '' : String(position.sellPrice),
        position.sellPrice === null
          ? ''
          : String(Math.round(profit(position.buyPrice, position.sellPrice, settings.taxPercent) * position.quantity)),
        position.sellPrice === null ? 'aperta' : 'chiusa',
        new Date(position.buyAt).toISOString(),
        position.sellAt ? new Date(position.sellAt).toISOString() : '',
      ]),
    ]
    const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `fc27-trader-portafoglio-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardTitle hint="Il conto reale: capitale fermo sulle carte, profitto già incassato e profitto solo sulla carta.">
          Bilancio
        </CardTitle>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Capitale investito" value={coins(invested)} hint={`${open.length} posizioni aperte`} />
          <Stat
            label="Profitto realizzato"
            value={signedCoins(realized)}
            tone={realized > 0 ? 'gain' : realized < 0 ? 'loss' : 'neutral'}
            hint={`${closed.length} trade chiusi`}
          />
          <Stat
            label="Profitto latente"
            value={unrealized ? signedCoins(unrealized) : '—'}
            tone={unrealized > 0 ? 'gain' : unrealized < 0 ? 'loss' : 'neutral'}
            hint="ai prezzi di mercato attuali"
          />
          <Stat label="Trade in utile" value={closed.length ? percent(winRate, 0) : '—'} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={buttonClass} onClick={exportCsv} disabled={data.positions.length === 0}>
            Esporta CSV
          </button>
        </div>
      </Card>

      <Card>
        <CardTitle>Registra un acquisto</CardTitle>
        <form
          className="grid grid-cols-1 gap-3 sm:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (!name.trim() || buyPrice <= 0) return
            addPosition({
              playerId: '',
              name: name.trim(),
              rating: 0,
              quantity: Math.max(1, quantity),
              buyPrice,
              platform: settings.platform,
              note: '',
            })
            setName('')
            setBuyPrice(0)
            setQuantity(1)
          }}
        >
          <label className="sm:col-span-2">
            <span className="text-[11px] uppercase tracking-[0.14em] text-chalk-dim">Giocatore</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Es. Lautaro Martínez"
              className="mt-1 w-full rounded-xl border border-pitch-line bg-pitch px-3 py-2 text-sm outline-none focus:border-gain/60"
            />
          </label>
          <NumberField label="Prezzo pagato" value={buyPrice} step={100} suffix="cr" onChange={setBuyPrice} />
          <NumberField label="Quantità" value={quantity} min={1} onChange={setQuantity} />
          <div className="sm:col-span-4">
            <button type="submit" className={primaryButtonClass} disabled={!name.trim() || buyPrice <= 0}>
              Aggiungi posizione
            </button>
            <span className="ml-3 text-xs text-chalk-dim">
              Dalla pagina Mercato l'acquisto viene registrato già collegato al giocatore.
            </span>
          </div>
        </form>
      </Card>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-chalk-dim">
          Posizioni aperte ({open.length})
        </h2>
        {open.length === 0 ? (
          <EmptyState title="Nessuna carta in magazzino">
            Registra un acquisto qui sopra oppure usa «Registra acquisto» dalla scheda di un giocatore.
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {open.map((position) => {
              const market = quotes[position.playerId]?.price ?? 0
              const latent = market ? profit(position.buyPrice, market, settings.taxPercent) * position.quantity : 0
              const draft = sellDrafts[position.id] ?? market ?? 0
              return (
                <li key={position.id}>
                  <Card>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="flex-1 text-sm font-semibold">{position.name}</p>
                      <Pill>{position.quantity}×</Pill>
                      <Pill tone={latent > 0 ? 'gain' : latent < 0 ? 'loss' : 'neutral'}>
                        {market ? signedCoins(latent) : 'prezzo n/d'}
                      </Pill>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <Stat label="Pagata" value={coins(position.buyPrice)} hint={dateTime(position.buyAt)} />
                      <Stat label="Mercato" value={market ? coins(market) : '—'} />
                      <Stat label="Capitale" value={coins(position.buyPrice * position.quantity)} />
                      <Stat
                        label="ROI attuale"
                        value={market ? percent(roiPercent(position.buyPrice, market, settings.taxPercent)) : '—'}
                        tone={latent > 0 ? 'gain' : latent < 0 ? 'loss' : 'neutral'}
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap items-end gap-2">
                      <div className="w-40">
                        <NumberField
                          label="Venduta a"
                          value={draft}
                          step={100}
                          suffix="cr"
                          onChange={(value) => setSellDrafts((current) => ({ ...current, [position.id]: value }))}
                        />
                      </div>
                      <button
                        type="button"
                        className={primaryButtonClass}
                        disabled={draft <= 0}
                        onClick={() => closePosition(position.id, draft)}
                      >
                        Chiudi trade
                      </button>
                      <button type="button" className={buttonClass} onClick={() => removePosition(position.id)}>
                        Elimina
                      </button>
                    </div>
                  </Card>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {closed.length > 0 ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-chalk-dim">
            Trade chiusi ({closed.length})
          </h2>
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[0.14em] text-chalk-dim">
                  <th className="py-2">Giocatore</th>
                  <th className="py-2">Acquisto</th>
                  <th className="py-2">Vendita</th>
                  <th className="py-2">Netto</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {closed.map((position) => {
                  const net = profit(position.buyPrice, position.sellPrice ?? 0, settings.taxPercent) * position.quantity
                  return (
                    <tr key={position.id} className="border-t border-pitch-line">
                      <td className="py-2 pr-2">
                        {position.name}
                        <span className="ml-1 text-xs text-chalk-dim">{position.quantity}×</span>
                      </td>
                      <td className="py-2 font-mono">{coins(position.buyPrice)}</td>
                      <td className="py-2 font-mono">{coins(position.sellPrice ?? 0)}</td>
                      <td className={`py-2 font-mono ${net > 0 ? 'text-gain' : net < 0 ? 'text-loss' : ''}`}>
                        {signedCoins(net)}
                      </td>
                      <td className="py-2 text-right">
                        <button type="button" className="text-xs text-chalk-dim hover:text-chalk" onClick={() => reopenPosition(position.id)}>
                          riapri
                        </button>
                        <button type="button" className="ml-3 text-xs text-chalk-dim hover:text-loss" onClick={() => removePosition(position.id)}>
                          elimina
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Card>
        </section>
      ) : null}
    </div>
  )
}
