import { useEffect, useState } from 'react'
import { finestre, stimaPrezzo } from '../../shared/forecast.mjs'
import { useStore } from '../lib/useStore.ts'
import type { HistoryPoint, Quote } from '../types.ts'
import { coins, percent } from '../lib/format.ts'
import { Pill } from './ui.tsx'

const TONO = {
  alta: 'gain',
  media: 'flag',
  bassa: 'neutral',
  'molto bassa': 'neutral',
  nessuna: 'neutral',
} as const

function quando(istante: number, adesso: number): string {
  const giorni = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato']
  const data = new Date(istante)
  const fraOre = Math.round((istante - adesso) / 3_600_000)
  const giorno = giorni[data.getDay()]
  const ora = data.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  if (fraOre <= 24) return `${giorno} alle ${ora} (fra ${Math.max(1, fraOre)}h)`
  return `${giorno} alle ${ora}`
}

/**
 * Mostra quanto dovrebbe costare adesso una carta segnata giorni fa, e quando
 * conviene muoversi. È una stima, e lo dice: numero, affidabilità e motivo
 * stanno sempre insieme.
 */
export default function PriceEstimate({
  history,
  quote,
  /** Quando è stato osservato quel prezzo: per i prezzi scritti a mano è la
   *  data in cui li hai scritti, non adesso. */
  osservatoIl,
  compact = false,
}: {
  history: HistoryPoint[]
  quote: Quote | null
  osservatoIl?: number
  compact?: boolean
}) {
  const { settings } = useStore()
  const calendario = settings.calendar

  // Il tempo passa anche a pagina ferma, e la stima dipende dall'ora: si
  // rinfresca da sola ogni dieci minuti invece di restare ferma a quando hai
  // aperto la scheda.
  const [adesso, setAdesso] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setAdesso(Date.now()), 10 * 60_000)
    return () => clearInterval(timer)
  }, [])

  const osservazione = quote?.price
    ? { price: quote.price, at: quote.manual ? (osservatoIl ?? adesso) : adesso }
    : null
  const stima = stimaPrezzo({ history, quote: osservazione, now: adesso, calendario })
  if (!stima.price) return null

  const scarto = stima.basePrice > 0 ? (stima.price / stima.basePrice - 1) * 100 : 0
  const previsioni = finestre({ history, now: adesso, calendario })
  const giorni = Math.floor(stima.giorniPassati)

  return (
    <div className={compact ? '' : 'rounded-xl border border-pitch-line bg-pitch/60 p-3'}>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-[11px] uppercase tracking-[0.14em] text-chalk-dim">Prezzo stimato ora</span>
        <span className="font-mono text-lg font-semibold">{coins(stima.price)}</span>
        {Math.abs(scarto) >= 1 ? (
          <span className={scarto > 0 ? 'text-xs text-gain' : 'text-xs text-loss'}>{percent(scarto)}</span>
        ) : null}
        <Pill tone={TONO[stima.confidenza]}>affidabilità {stima.confidenza}</Pill>
      </div>
      <p className="mt-1 text-xs text-chalk-dim">
        Parte da {coins(stima.basePrice)}
        {giorni >= 1 ? ` segnato ${giorni === 1 ? 'un giorno' : `${giorni} giorni`} fa` : ' segnato poco fa'}:{' '}
        {stima.spiegazione}.
        {stima.imparato ? ' Il calcolo usa anche i prezzi che hai registrato per questa carta.' : ''}
      </p>

      {previsioni.acquisto || previsioni.vendita ? (
        <ul className="mt-2 space-y-1 text-xs">
          {previsioni.acquisto ? (
            <li className="text-chalk-dim">
              <span className="text-gain">▼</span> Atteso più basso {quando(previsioni.acquisto.quando, adesso)} ·{' '}
              {previsioni.acquisto.fase.label.toLowerCase()} ({percent(previsioni.acquisto.variazioneAttesa)})
            </li>
          ) : null}
          {previsioni.vendita ? (
            <li className="text-chalk-dim">
              <span className="text-loss">▲</span> Atteso più alto {quando(previsioni.vendita.quando, adesso)} ·{' '}
              {previsioni.vendita.fase.label.toLowerCase()} ({percent(previsioni.vendita.variazioneAttesa)})
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  )
}
