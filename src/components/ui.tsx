import type { ChangeEvent, ReactNode } from 'react'

import { percent } from '../lib/format.ts'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-pitch-line bg-pitch-soft/70 p-4 sm:p-5 ${className}`}>
      {children}
    </section>
  )
}

export function CardTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <header className="mb-3">
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-chalk-dim">{children}</h2>
      {hint ? <p className="mt-1 text-xs text-chalk-dim/80">{hint}</p> : null}
    </header>
  )
}

export function Stat({
  label,
  value,
  tone = 'neutral',
  hint,
}: {
  label: string
  value: string
  tone?: 'neutral' | 'gain' | 'loss'
  hint?: string
}) {
  const color = tone === 'gain' ? 'text-gain' : tone === 'loss' ? 'text-loss' : 'text-chalk'
  return (
    <div className="rounded-xl border border-pitch-line bg-pitch/60 px-3 py-3">
      <p className="text-[11px] uppercase tracking-[0.14em] text-chalk-dim">{label}</p>
      <p className={`mt-1 font-mono text-lg font-semibold ${color}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-chalk-dim/80">{hint}</p> : null}
    </div>
  )
}

export function NumberField({
  label,
  value,
  onChange,
  suffix,
  min = 0,
  step = 1,
  hint,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  suffix?: string
  min?: number
  step?: number
  hint?: string
}) {
  const handle = (event: ChangeEvent<HTMLInputElement>) => {
    const parsed = Number.parseFloat(event.target.value)
    onChange(Number.isFinite(parsed) ? parsed : 0)
  }
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-[0.14em] text-chalk-dim">{label}</span>
      <span className="mt-1 flex items-center gap-2 rounded-xl border border-pitch-line bg-pitch px-3 py-2 focus-within:border-gain/60">
        <input
          type="number"
          inputMode="numeric"
          min={min}
          step={step}
          value={Number.isFinite(value) ? value : 0}
          onChange={handle}
          className="w-full bg-transparent font-mono text-base text-chalk outline-none"
        />
        {suffix ? <span className="text-xs text-chalk-dim">{suffix}</span> : null}
      </span>
      {hint ? <span className="mt-1 block text-[11px] text-chalk-dim/80">{hint}</span> : null}
    </label>
  )
}

export function Delta({ value }: { value: number }) {
  if (!Number.isFinite(value) || value === 0) return <span className="text-chalk-dim">—</span>
  return <span className={value > 0 ? 'text-gain' : 'text-loss'}>{percent(value)}</span>
}

export function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'gain' | 'loss' | 'flag' }) {
  const tones = {
    neutral: 'border-pitch-line text-chalk-dim',
    gain: 'border-gain/40 text-gain bg-gain/10',
    loss: 'border-loss/40 text-loss bg-loss/10',
    flag: 'border-flag/40 text-flag bg-flag/10',
  }
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] ${tones[tone]}`}>
      {children}
    </span>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-pitch-line px-5 py-10 text-center">
      <p className="text-sm font-semibold text-chalk">{title}</p>
      {children ? <div className="mx-auto mt-2 max-w-md text-sm text-chalk-dim">{children}</div> : null}
    </div>
  )
}

export const buttonClass =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-pitch-line bg-pitch px-3 py-2 text-sm font-medium text-chalk transition hover:border-gain/50 hover:text-gain disabled:cursor-not-allowed disabled:opacity-40'

export const primaryButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-gain px-4 py-2 text-sm font-semibold text-pitch transition hover:bg-gain/85 disabled:cursor-not-allowed disabled:opacity-40'
