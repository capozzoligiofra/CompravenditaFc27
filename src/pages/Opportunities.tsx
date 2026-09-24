import { useState } from 'react'
import { Link } from 'react-router-dom'

import PlayerLink from '../components/PlayerLink.tsx'
import Welcome from '../components/Welcome.tsx'
import { Card, CardTitle, EmptyState, Pill, Stat, buttonClass, primaryButtonClass } from '../components/ui.tsx'
import type { Opportunity, OpportunityAction } from '../../shared/scoring.d.mts'
import { coins, signedCoins } from '../lib/format.ts'
import { useOpportunities } from '../lib/useOpportunities.ts'
import { useStore } from '../lib/useStore.ts'

const ACTION: Record<OpportunityAction, { label: string; tone: 'gain' | 'loss' | 'flag' | 'neutral' }> = {
  compra: { label: 'compra ora', tone: 'gain' },
  prepara: { label: 'tieni pronto', tone: 'flag' },
  osserva: { label: 'osserva', tone: 'neutral' },
  evita: { label: 'lascia stare', tone: 'neutral' },
  vendi: { label: 'vendi', tone: 'loss' },
  tieni: { label: 'tieni', tone: 'neutral' },
}

function countdown(target: number): string {
  const diff = target - Date.now()
  if (diff <= 0) return 'adesso'
  const ore = Math.floor(diff / 3_600_000)
  const minuti = Math.round((diff % 3_600_000) / 60_000)
  if (ore >= 24) {
    const giorni = Math.floor(ore / 24)
    return `fra ${giorni} ${giorni === 1 ? 'giorno' : 'giorni'}`
  }
  if (ore === 0) return `fra ${minuti} min`
  return `fra ${ore}h ${minuti.toString().padStart(2, '0')}m`
}

function ScoreBar({ score }: { score: number }) {
  const tone = score >= 70 ? 'bg-gain' : score >= 52 ? 'bg-flag' : 'bg-chalk-dim'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-pitch">
        <div className={`h-full ${tone}`} style={{ width: `${Math.max(4, score)}%` }} />
      </div>
      <span className="font-mono text-xs text-chalk-dim">{score}</span>
    </div>
  )
}

function CatalystForm() {
  const { addCatalyst } = useStore()
  const [title, setTitle] = useState('')
  const [minRating, setMinRating] = useState('')
  const [league, setLeague] = useState('')
  const [nation, setNation] = useState('')

  return (
    <form
      className="mt-3 grid grid-cols-2 gap-2 border-t border-pitch-line pt-3 sm:grid-cols-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (!title.trim()) return
        addCatalyst({
          title: title.trim(),
          kind: 'sbc',
          detail: 'Inserito da te.',
          impact: 3,
          match: {
            minRating: minRating ? Number(minRating) : null,
            maxRating: null,
            leagues: league ? [league.trim()] : [],
            nations: nation ? [nation.trim()] : [],
            clubs: [],
            positions: [],
            players: [],
          },
        })
        setTitle('')
        setMinRating('')
        setLeague('')
        setNation('')
      }}
    >
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Es. SBC Serie A 84+"
        className="col-span-2 rounded-xl border border-pitch-line bg-pitch px-3 py-2 text-sm outline-none focus:border-gain/60 sm:col-span-4"
      />
      <input
        value={minRating}
        onChange={(event) => setMinRating(event.target.value)}
        inputMode="numeric"
        placeholder="Val. min"
        className="rounded-xl border border-pitch-line bg-pitch px-3 py-2 text-sm outline-none focus:border-gain/60"
      />
      <input
        value={league}
        onChange={(event) => setLeague(event.target.value)}
        placeholder="Lega"
        className="rounded-xl border border-pitch-line bg-pitch px-3 py-2 text-sm outline-none focus:border-gain/60"
      />
      <input
        value={nation}
        onChange={(event) => setNation(event.target.value)}
        placeholder="Nazione"
        className="rounded-xl border border-pitch-line bg-pitch px-3 py-2 text-sm outline-none focus:border-gain/60"
      />
      <button type="submit" className={buttonClass} disabled={!title.trim()}>
        Aggiungi
      </button>
    </form>
  )
}

function OpportunityCard({ opportunity }: { opportunity: Opportunity }) {
  const { addWatch, isWatched, addPosition, settings } = useStore()
  const [open, setOpen] = useState(false)
  const action = ACTION[opportunity.action]
  const player = opportunity.player as Opportunity['player'] & { position?: string; club?: string }

  return (
    <Card>
      <div className="flex flex-wrap items-start gap-3">
        <span className="w-9 shrink-0 rounded-lg bg-flag/15 py-1 text-center font-mono text-sm font-bold text-flag">
          {player.rating || '—'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            <PlayerLink id={player.id}>{player.name}</PlayerLink>
          </p>
          <p className="truncate text-xs text-chalk-dim">
            {[player.position, player.club].filter(Boolean).join(' · ') || 'scheda da aprire'}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Pill tone={action.tone}>{action.label}</Pill>
          <ScoreBar score={opportunity.score} />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Compra entro" value={coins(opportunity.buyBelow)} hint="BIN massimo consigliato" />
        <Stat label="Rivendi verso" value={coins(opportunity.sellAt)} hint="stima, non una promessa" />
        <Stat
          label="Profitto stimato"
          value={signedCoins(opportunity.expectedProfit)}
          tone={opportunity.expectedProfit > 0 ? 'gain' : 'neutral'}
          hint={`tassa ${settings.taxPercent}% inclusa`}
        />
        <Stat label="Affidabilità" value={opportunity.confidence} hint={opportunity.overBudget ? 'fuori budget' : undefined} />
      </div>

      <ul className="mt-3 space-y-1">
        {opportunity.reasons.slice(0, open ? 8 : 3).map((reason) => (
          <li key={reason.label} className="flex gap-2 text-xs text-chalk-dim">
            <span className={reason.weight >= 0 ? 'text-gain' : 'text-loss'}>{reason.weight >= 0 ? '▲' : '▼'}</span>
            <span>{reason.label}</span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap gap-2">
        {opportunity.reasons.length > 3 ? (
          <button type="button" className={buttonClass} onClick={() => setOpen(!open)}>
            {open ? 'Meno dettagli' : 'Perché'}
          </button>
        ) : null}
        <button
          type="button"
          className={primaryButtonClass}
          disabled={isWatched(player.id)}
          onClick={() =>
            addWatch({
              id: player.id,
              name: player.name,
              rating: player.rating,
              position: player.position ?? '',
              club: player.club ?? '',
              buyTarget: opportunity.buyBelow,
              sellTarget: opportunity.sellAt,
              note: opportunity.reasons[0]?.label ?? '',
            })
          }
        >
          {isWatched(player.id) ? 'Già in watchlist' : 'Seguila'}
        </button>
        <button
          type="button"
          className={buttonClass}
          onClick={() =>
            addPosition({
              playerId: player.id,
              name: player.name,
              rating: player.rating,
              quantity: 1,
              buyPrice: opportunity.buyBelow,
              platform: settings.platform,
              note: 'comprata da Occasioni',
            })
          }
        >
          Ho comprato
        </button>
      </div>
    </Card>
  )
}

export default function Opportunities() {
  const { loading, refining, error, source, opportunities, catalysts, catalystsReason, phase, events } =
    useOpportunities()
  const { data, removeCatalyst } = useStore()
  // Chi apre il link la prima volta non ha niente: prima di tutto gli si dice
  // cos'ha davanti e da dove si comincia.
  const vuota =
    data.seen.length === 0 && data.watchlist.length === 0 && data.positions.length === 0

  return (
    <div className="space-y-5">
      <Welcome vuota={vuota} />
      <Card>
        <CardTitle hint="Il ciclo settimanale di Ultimate Team è la prima causa dei movimenti di prezzo.">
          Momento del mercato
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={phase.bias > 0 ? 'gain' : phase.bias < 0 ? 'loss' : 'neutral'}>{phase.label}</Pill>
          <span className="text-sm text-chalk-dim">{phase.advice}</span>
        </div>
        <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {events.map((event) => (
            <li key={event.id} className="rounded-xl border border-pitch-line bg-pitch/60 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{event.label}</span>
                <span className="font-mono text-xs text-chalk-dim">{countdown(event.at)}</span>
              </div>
              <p className="mt-0.5 text-xs text-chalk-dim">{event.detail}</p>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardTitle hint="SBC, obiettivi e promo che fanno salire la domanda su certe carte.">Catalizzatori</CardTitle>
        {catalysts.length === 0 ? (
          <p className="text-sm text-chalk-dim">
            Nessun catalizzatore rilevato da Futbin{catalystsReason ? ` (${catalystsReason})` : ''}. Aggiungi a mano
            quello che vedi in gioco: basta il titolo e, se lo sai, la valutazione o la lega richiesta.
          </p>
        ) : (
          <ul className="space-y-2">
            {catalysts.map((catalyst) => (
              <li
                key={catalyst.id}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-pitch-line bg-pitch/60 px-3 py-2"
              >
                <Pill tone={catalyst.source === 'manuale' ? 'neutral' : 'gain'}>{catalyst.kind}</Pill>
                <span className="min-w-0 flex-1 text-sm">{catalyst.title}</span>
                {catalyst.source === 'manuale' ? (
                  <button
                    type="button"
                    className="text-xs text-chalk-dim hover:text-loss"
                    onClick={() => removeCatalyst(catalyst.id)}
                  >
                    togli
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <CatalystForm />
      </Card>

      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-chalk-dim">Da comprare</h2>
          <span className="text-xs text-chalk-dim">
            {loading ? 'calcolo in corso…' : refining ? 'sto approfondendo i primi…' : `${opportunities.length} proposte`}
            {source === 'demo' ? ' · su dati demo' : ''}
          </span>
        </div>
        {error ? <p className="mb-2 text-xs text-flag">{error}</p> : null}

        {opportunities.length === 0 && !loading ? (
          <EmptyState title="Ancora nessuna proposta">
            Apri qualche scheda giocatore dal <Link to="/mercato" className="text-gain underline">Mercato</Link> o
            aggiungi carte alla watchlist: l'app cerca le occasioni fra i giocatori che segui.
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {opportunities.map((opportunity) => (
              <li key={opportunity.player.id}>
                <OpportunityCard opportunity={opportunity} />
              </li>
            ))}
          </ul>
        )}

        <p className="mt-3 text-xs text-chalk-dim">
          I punteggi pesano prezzo, storico, catalizzatori e momento della settimana: sono un aiuto a decidere, non
          una previsione. Le cifre di rivendita sono stime, non garanzie.
        </p>
      </section>
    </div>
  )
}
