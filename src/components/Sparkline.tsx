import type { HistoryPoint } from '../types.ts'
import { coins, shortDate } from '../lib/format.ts'

/**
 * Grafico prezzi disegnato a mano in SVG: niente librerie, niente peso extra,
 * e resta leggibile anche con pochi punti.
 */
export default function Sparkline({ points, height = 120 }: { points: HistoryPoint[]; height?: number }) {
  if (points.length < 2) {
    return (
      <div className="flex h-[120px] items-center justify-center rounded-xl border border-dashed border-pitch-line text-xs text-chalk-dim">
        Storico prezzi non disponibile
      </div>
    )
  }

  const width = 600
  const prices = points.map((point) => point.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const span = max - min || 1
  const stepX = width / (points.length - 1)

  const coords = points.map((point, index) => {
    const x = index * stepX
    const y = height - ((point.price - min) / span) * (height - 16) - 8
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const line = `M ${coords.join(' L ')}`
  const area = `${line} L ${width},${height} L 0,${height} Z`
  const rising = prices.at(-1)! >= prices[0]
  const stroke = rising ? 'var(--color-gain)' : 'var(--color-loss)'

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[120px] w-full" preserveAspectRatio="none" role="img" aria-label="Andamento prezzi">
        <path d={area} fill={stroke} opacity="0.12" />
        <path d={line} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption className="mt-2 flex justify-between font-mono text-[11px] text-chalk-dim">
        <span>{shortDate(points[0].t)}</span>
        <span>min {coins(min)} · max {coins(max)}</span>
        <span>{shortDate(points.at(-1)!.t)}</span>
      </figcaption>
    </figure>
  )
}
