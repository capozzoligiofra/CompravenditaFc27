import { useState } from 'react'

import { Card, CardTitle, NumberField, Stat } from '../components/ui.tsx'
import { coins, percent, signedCoins } from '../lib/format.ts'
import {
  breakEvenSell,
  maxBuyForMargin,
  maxBuyForProfit,
  netFromSale,
  profit,
  roiPercent,
  roundToMarketStep,
  sellForMargin,
  taxAmount,
} from '../../shared/market.mjs'
import { useStore } from '../lib/useStore.ts'

export default function Calculator() {
  const { settings } = useStore()
  const tax = settings.taxPercent

  const [buyPrice, setBuyPrice] = useState(10_000)
  const [sellPrice, setSellPrice] = useState(12_000)
  const [quantity, setQuantity] = useState(1)
  const [targetSell, setTargetSell] = useState(12_000)
  const [wantedProfit, setWantedProfit] = useState(1_000)
  const [margin, setMargin] = useState(settings.targetMarginPercent)

  const unitProfit = profit(buyPrice, sellPrice, tax)
  const totalProfit = unitProfit * quantity
  const totalCost = buyPrice * quantity
  const roi = roiPercent(buyPrice, sellPrice, tax)
  const binForMargin = roundToMarketStep(maxBuyForMargin(targetSell, margin, tax))
  const binForProfit = roundToMarketStep(maxBuyForProfit(targetSell, wantedProfit, tax))
  const cardsWithBudget = binForMargin > 0 && settings.budget > 0 ? Math.floor(settings.budget / binForMargin) : 0

  return (
    <div className="space-y-5">
      <Card>
        <CardTitle hint={`Ogni vendita paga ${tax}% di tassa EA: è la differenza fra un margine vero e uno apparente.`}>
          Margine su un trade
        </CardTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <NumberField label="Prezzo di acquisto" value={buyPrice} step={100} suffix="cr" onChange={setBuyPrice} />
          <NumberField label="Prezzo di vendita" value={sellPrice} step={100} suffix="cr" onChange={setSellPrice} />
          <NumberField label="Quantità carte" value={quantity} min={1} onChange={setQuantity} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Incasso netto" value={coins(netFromSale(sellPrice, tax))} hint={`tassa ${coins(taxAmount(sellPrice, tax))}`} />
          <Stat
            label="Profitto per carta"
            value={signedCoins(unitProfit)}
            tone={unitProfit > 0 ? 'gain' : unitProfit < 0 ? 'loss' : 'neutral'}
          />
          <Stat
            label={`Profitto totale (${quantity})`}
            value={signedCoins(totalProfit)}
            tone={totalProfit > 0 ? 'gain' : totalProfit < 0 ? 'loss' : 'neutral'}
            hint={`capitale impegnato ${coins(totalCost)}`}
          />
          <Stat label="ROI" value={percent(roi)} tone={roi > 0 ? 'gain' : roi < 0 ? 'loss' : 'neutral'} />
        </div>

        <p className="mt-3 text-sm text-chalk-dim">
          Pareggio a <strong className="font-mono text-chalk">{coins(breakEvenSell(buyPrice, tax))}</strong> crediti:
          sotto questa cifra la vendita è in perdita. Per un margine del {margin}% dovresti chiedere{' '}
          <strong className="font-mono text-chalk">{coins(sellForMargin(buyPrice, margin, tax))}</strong>.
        </p>
      </Card>

      <Card>
        <CardTitle hint="Il numero da inserire come «BIN massimo» nel filtro di ricerca del gioco.">
          Prezzo massimo di acquisto (sniping)
        </CardTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <NumberField label="Prezzo di rivendita atteso" value={targetSell} step={100} suffix="cr" onChange={setTargetSell} />
          <NumberField label="Margine obiettivo" value={margin} step={1} suffix="%" onChange={setMargin} />
          <NumberField label="Profitto minimo per carta" value={wantedProfit} step={100} suffix="cr" onChange={setWantedProfit} />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Stat label={`BIN max per ${margin}%`} value={coins(binForMargin)} hint="arrotondato allo scalino di mercato" />
          <Stat label={`BIN max per ${coins(wantedProfit)} cr`} value={coins(binForProfit)} />
          <Stat
            label="Carte comprabili col budget"
            value={cardsWithBudget ? String(cardsWithBudget) : '—'}
            hint={settings.budget ? `budget ${coins(settings.budget)} cr` : 'imposta il budget nelle impostazioni'}
          />
        </div>
      </Card>

      <Card>
        <CardTitle>Tabella rapida dei margini</CardTitle>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.14em] text-chalk-dim">
                <th className="py-2">Margine</th>
                <th className="py-2">Compra entro</th>
                <th className="py-2">Profitto netto</th>
                <th className="py-2">Su 10 carte</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {[5, 10, 15, 20, 25, 30, 50].map((value) => {
                const bin = roundToMarketStep(maxBuyForMargin(targetSell, value, tax))
                const gain = profit(bin, targetSell, tax)
                return (
                  <tr key={value} className="border-t border-pitch-line">
                    <td className="py-2 text-chalk-dim">{value}%</td>
                    <td className="py-2">{coins(bin)}</td>
                    <td className="py-2 text-gain">{signedCoins(gain)}</td>
                    <td className="py-2 text-gain">{signedCoins(gain * 10)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-chalk-dim">
          Calcolato su una rivendita a {coins(targetSell)} crediti con tassa al {tax}%.
        </p>
      </Card>
    </div>
  )
}
