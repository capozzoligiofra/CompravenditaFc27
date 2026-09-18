import { NavLink, Outlet } from 'react-router-dom'


import type { HealthResponse } from '../lib/api.ts'
import { useHealth } from '../lib/useHealth.ts'
import { useStore } from '../lib/useStore.ts'
import type { Platform } from '../types.ts'

const NAV = [
  { to: '/', label: 'Occasioni', end: true },
  { to: '/mercato', label: 'Mercato' },
  { to: '/watchlist', label: 'Watchlist' },
  { to: '/calcolatore', label: 'Calcoli' },
  { to: '/portafoglio', label: 'Conti' },
  { to: '/impostazioni', label: 'Opzioni' },
]

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'ps', label: 'PlayStation' },
  { value: 'xbox', label: 'Xbox' },
  { value: 'pc', label: 'PC' },
]

const BADGE_TONES = {
  gain: 'border-gain/40 bg-gain/10 text-gain',
  flag: 'border-flag/40 bg-flag/10 text-flag',
  loss: 'border-loss/40 bg-loss/10 text-loss',
  neutral: 'border-pitch-line text-chalk-dim',
} as const

type BadgeTone = keyof typeof BADGE_TONES

/** Il badge non promette mai più di quello che l'app ha davvero in mano. */
function badgeState(health: HealthResponse): { label: string; tone: BadgeTone } {
  if (health.fromCache) return { label: 'offline', tone: 'loss' }
  if (health.mode === 'statico') return { label: 'dati demo', tone: 'flag' }
  if (!health.futbin.enabled) return { label: 'dati demo', tone: 'flag' }
  if (health.futbin.reachable === true) {
    return { label: health.futbin.year ? `Futbin FC${health.futbin.year}` : 'Futbin', tone: 'gain' }
  }
  if (health.futbin.reachable === false) return { label: 'dati demo', tone: 'flag' }
  // Nessuna richiesta ancora partita: non sappiamo se Futbin risponde.
  return { label: 'sorgente da verificare', tone: 'neutral' }
}

function SourceBadge() {
  const { loading, health, error } = useHealth()

  if (loading) return <span className="text-[11px] text-chalk-dim">verifica sorgente…</span>
  if (error || !health) {
    return (
      <span className="rounded-full border border-loss/40 bg-loss/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-loss">
        sorgente non disponibile
      </span>
    )
  }

  const state = badgeState(health)
  return (
    <span
      title={health.lastError ?? undefined}
      className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] ${BADGE_TONES[state.tone]}`}
    >
      {state.label}
    </span>
  )
}

function navLinkClass({ isActive }: { isActive: boolean }) {
  return `inline-block whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition ${
    isActive ? 'bg-gain/15 font-semibold text-gain' : 'text-chalk-dim hover:text-chalk'
  }`
}

export default function Layout() {
  const { data, settings, updateSettings } = useStore()
  const nonLetti = data.alerts.filter((alert) => !alert.read).length

  return (
    <div className="min-h-screen bg-pitch">
      <header className="sticky top-0 z-10 border-b border-pitch-line bg-pitch/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-base font-bold tracking-tight text-gain">FC27</span>
            <span className="text-base font-semibold tracking-tight">Trader</span>
          </div>
          <SourceBadge />
          <NavLink
            to="/avvisi"
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-pitch-line px-2 py-1 text-xs text-chalk-dim transition hover:text-chalk"
            title="Avvisi"
          >
            <span aria-hidden>🔔</span>
            <span className="sr-only">Avvisi</span>
            {nonLetti > 0 ? (
              <span className="rounded-full bg-gain px-1.5 font-mono text-[11px] font-bold text-pitch">{nonLetti}</span>
            ) : null}
          </NavLink>
          <label className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-chalk-dim">
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

        {/* Da tablet in su la navigazione sta sotto l'intestazione… */}
        <nav className="mx-auto hidden max-w-5xl px-4 sm:block">
          <ul className="flex gap-1 pb-2">
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end} className={navLinkClass}>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-5 pb-28 sm:pb-16">
        <Outlet />
      </main>

      {/* …sul telefono diventa una barra in basso, raggiungibile col pollice. */}
      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-pitch-line bg-pitch/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
        <ul className="flex items-stretch justify-between px-1 py-1.5">
          {NAV.map((item) => (
            <li key={item.to} className="flex-1">
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex h-full items-center justify-center rounded-lg px-1 py-2 text-center text-[11px] leading-tight transition ${
                    isActive ? 'bg-gain/15 font-semibold text-gain' : 'text-chalk-dim'
                  }`
                }
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
