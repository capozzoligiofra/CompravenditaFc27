import { NavLink, Outlet } from 'react-router-dom'

import { useHealth } from '../lib/useHealth.ts'
import { useStore } from '../lib/useStore.ts'
import type { Platform } from '../types.ts'

const NAV = [
  { to: '/', label: 'Mercato', end: true },
  { to: '/watchlist', label: 'Watchlist' },
  { to: '/calcolatore', label: 'Calcolatore' },
  { to: '/portafoglio', label: 'Portafoglio' },
  { to: '/impostazioni', label: 'Impostazioni' },
]

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'ps', label: 'PlayStation' },
  { value: 'xbox', label: 'Xbox' },
  { value: 'pc', label: 'PC' },
]

function SourceBadge() {
  const { loading, health, error } = useHealth()

  if (loading) return <span className="text-[11px] text-chalk-dim">verifica sorgente…</span>
  if (error || !health) {
    return (
      <span className="rounded-full border border-loss/40 bg-loss/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-loss">
        proxy offline
      </span>
    )
  }

  const live = health.futbin.enabled && health.futbin.reachable !== false
  return (
    <span
      title={health.lastError ?? undefined}
      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] ${
        live ? 'border-gain/40 bg-gain/10 text-gain' : 'border-flag/40 bg-flag/10 text-flag'
      }`}
    >
      {live ? `Futbin FC${health.futbin.year}` : 'dati demo'}
    </span>
  )
}

export default function Layout() {
  const { settings, updateSettings } = useStore()

  return (
    <div className="min-h-screen bg-pitch">
      <header className="sticky top-0 z-10 border-b border-pitch-line bg-pitch/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-base font-bold tracking-tight text-gain">FC27</span>
            <span className="text-base font-semibold tracking-tight">Trader</span>
          </div>
          <SourceBadge />
          <label className="ml-auto flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-chalk-dim">
            Piattaforma
            <select
              value={settings.platform}
              onChange={(event) => updateSettings({ platform: event.target.value as Platform })}
              className="rounded-lg border border-pitch-line bg-pitch-soft px-2 py-1 text-xs font-semibold normal-case tracking-normal text-chalk outline-none focus:border-gain/60"
            >
              {PLATFORMS.map((platform) => (
                <option key={platform.value} value={platform.value}>
                  {platform.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <nav className="mx-auto max-w-5xl overflow-x-auto px-4">
          <ul className="flex gap-1 pb-2">
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `inline-block whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition ${
                      isActive ? 'bg-gain/15 font-semibold text-gain' : 'text-chalk-dim hover:text-chalk'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-5 pb-16">
        <Outlet />
      </main>
    </div>
  )
}
