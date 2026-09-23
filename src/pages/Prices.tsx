import { useEffect, useMemo, useRef, useState } from 'react'

import PriceListImport from '../components/PriceListImport.tsx'
import { Card, CardTitle, EmptyState, Pill, Stat, buttonClass } from '../components/ui.tsx'
import { searchPlayers, sendManualPrice } from '../lib/api.ts'
import { coins } from '../lib/format.ts'
import { stimaPrezzo } from '../../shared/forecast.mjs'
import { filtraVoci, ordinaVoci, riepilogo, vociPrezzo } from '../../shared/price-entry.mjs'
import type { GruppoPrezzo, VocePrezzo } from '../../shared/price-entry.d.mts'
import { parseCoinsLoose } from '../../shared/roster-import.mjs'
import { useStore } from '../lib/useStore.ts'
import type { Player } from '../types.ts'

const GRUPPI: { value: GruppoPrezzo; label: string }[] = [
  { value: 'da-aggiornare', label: 'Da aggiornare' },
  { value: 'rosa', label: 'La mia rosa' },
  { value: 'watchlist', label: 'Watchlist' },
  { value: 'tutte', label: 'Tutte' },
]

const STATO = {
  mai: { label: 'mai segnato', tone: 'flag' },
  vecchio: { label: 'da aggiornare', tone: 'neutral' },
  oggi: { label: 'fatto', tone: 'gain' },
} as const

/** «2 giorni fa», «poco fa»: quanto è vecchio il prezzo, in parole. */
function anzianita(osservatoIl: number, adesso: number): string {
  if (!osservatoIl) return 'mai segnato'
  const ore = Math.floor((adesso - osservatoIl) / 3_600_000)
  if (ore < 1) return 'poco fa'
  if (ore < 24) return `${ore} ${ore === 1 ? 'ora' : 'ore'} fa`
  const giorni = Math.floor(ore / 24)
  return `${giorni} ${giorni === 1 ? 'giorno' : 'giorni'} fa`
}

/**
 * Il pannello dei prezzi: una riga per carta, si scrive la cifra e si preme
 * Invio per salvare e saltare alla riga dopo. È la schermata da tenere aperta
 * accanto al gioco mentre si gira il mercato.
 */
export default function Prices() {
  const { data, settings, prezzi, setManualPrice, rememberPlayer } = useStore()
  const [gruppo, setGruppo] = useState<GruppoPrezzo>('da-aggiornare')
  const [testo, setTesto] = useState('')
  const [bozze, setBozze] = useState<Record<string, string>>({})
  // Di ogni carta sistemata in questa sessione teniamo anche quanto era
  // vecchio il prezzo di prima: serve a non farla saltare di posto.
  const [salvati, setSalvati] = useState<Record<string, { prezzo: number; eraOsservatoIl: number }>>({})
  const campi = useRef(new Map<string, HTMLInputElement>())

  // L'ora serve per dire da quanto tempo un prezzo è lì: si rinfresca da sola.
  const [adesso, setAdesso] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setAdesso(Date.now()), 10 * 60_000)
    return () => clearInterval(timer)
  }, [])

  const voci = useMemo(
    () =>
      vociPrezzo({
        seen: data.seen,
        watchlist: data.watchlist,
        positions: data.positions,
        // Il listino condiviso e i tuoi prezzi, già fusi: quello che vale
        // adesso, chiunque l'abbia segnato.
        manualPrices: prezzi,
        priceHistory: data.priceHistory,
        now: adesso,
      }) as VocePrezzo[],
    [data.seen, data.watchlist, data.positions, prezzi, data.priceHistory, adesso],
  )

  // Le righe sistemate poco fa restano dove sono e restano visibili, anche
  // nel filtro «da aggiornare»: se sparissero appena premi Invio, la riga
  // successiva scivolerebbe sotto il cursore e scriveresti sulla carta
  // sbagliata.
  const elenco = useMemo(() => {
    const filtrate = filtraVoci(voci, { gruppo, testo, tieni: Object.keys(salvati) }) as VocePrezzo[]
    return ordinaVoci(filtrate, (voce) => salvati[voce.id]?.eraOsservatoIl ?? voce.osservatoIl) as VocePrezzo[]
  }, [voci, gruppo, testo, salvati])

  const conti = riepilogo(voci)

  const salva = (voce: VocePrezzo, testoCampo: string) => {
    const prezzo = parseCoinsLoose(testoCampo)
    if (!(prezzo > 0)) return false
    setManualPrice(voce.id, prezzo)
    setBozze((current) => ({ ...current, [voce.id]: '' }))
    setSalvati((current) => ({
      ...current,
      [voce.id]: { prezzo, eraOsservatoIl: current[voce.id]?.eraOsservatoIl ?? voce.osservatoIl },
    }))
    // Finisce anche nell'archivio del proxy, se c'è.
    void sendManualPrice(voce.id, settings.platform, prezzo, data.seen.find((player) => player.id === voce.id) ?? null)
    return true
  }

  /** Invio: salva e porta il cursore sulla riga successiva. */
  const salvaEAvanza = (indice: number) => {
    const voce = elenco[indice]
    if (!voce) return
    if (!salva(voce, bozze[voce.id] ?? '')) return
    const prossima = elenco[indice + 1]
    if (prossima) campi.current.get(prossima.id)?.focus()
    else campi.current.get(voce.id)?.blur()
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle hint="Scrivi la cifra che vedi sul mercato e premi Invio: salvi e passi alla carta dopo. Vanno bene anche 44k e 1,2M.">
          Prezzi
        </CardTitle>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Carte seguite" value={String(conti.totale)} />
          <Stat
            label="Segnate oggi"
            value={String(conti.aggiornate)}
            tone={conti.aggiornate > 0 ? 'gain' : 'neutral'}
          />
          <Stat
            label="Da aggiornare"
            value={String(conti.daAggiornare)}
            tone={conti.daAggiornare > 0 ? 'loss' : 'neutral'}
            hint={conti.mai > 0 ? `${conti.mai} mai segnate` : undefined}
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {GRUPPI.map((voce) => (
            <button
              key={voce.value}
              type="button"
              onClick={() => setGruppo(voce.value)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                gruppo === voce.value
                  ? 'border-gain/50 bg-gain/15 text-gain'
                  : 'border-pitch-line text-chalk-dim hover:text-chalk'
              }`}
            >
              {voce.label}
            </button>
          ))}
          <input
            value={testo}
            onChange={(event) => setTesto(event.target.value)}
            placeholder="Filtra per nome"
            className="ml-auto w-40 rounded-xl border border-pitch-line bg-pitch px-3 py-1.5 text-sm outline-none focus:border-gain/60"
          />
        </div>
      </Card>

      {elenco.length === 0 ? (
        <EmptyState title={conti.totale === 0 ? 'Nessuna carta da prezzare' : 'Qui è tutto a posto'}>
          {conti.totale === 0
            ? 'Aggiungi qui sotto le carte che ti interessano, oppure importa la rosa da Conti: appariranno in questo elenco.'
            : 'Non ci sono carte che rispondono al filtro. Prova con «Tutte».'}
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {elenco.map((voce, indice) => (
            <li key={voce.id}>
              <RigaPrezzo
                voce={voce}
                adesso={adesso}
                autore={prezzi[voce.id]?.autore ?? ''}
                mio={Boolean(data.manualPrices[voce.id])}
                storico={data.priceHistory[voce.id] ?? []}
                bozza={bozze[voce.id] ?? ''}
                appenaSalvato={salvati[voce.id]?.prezzo ?? 0}
                onBozza={(valore) => setBozze((current) => ({ ...current, [voce.id]: valore }))}
                onInvio={() => salvaEAvanza(indice)}
                onSalva={() => salva(voce, bozze[voce.id] ?? '')}
                onTogli={() => {
                  setManualPrice(voce.id, 0)
                  setSalvati((current) => {
                    const next = { ...current }
                    delete next[voce.id]
                    return next
                  })
                }}
                registraCampo={(elemento) => {
                  if (elemento) campi.current.set(voce.id, elemento)
                  else campi.current.delete(voce.id)
                }}
              />
            </li>
          ))}
        </ul>
      )}

      <AggiungiCarta onAdd={rememberPlayer} conosciuti={voci.map((voce) => voce.id)} />
      <PriceListImport />
    </div>
  )
}

function RigaPrezzo({
  voce,
  adesso,
  autore,
  mio,
  storico,
  bozza,
  appenaSalvato,
  onBozza,
  onInvio,
  onSalva,
  onTogli,
  registraCampo,
}: {
  voce: VocePrezzo
  adesso: number
  /** Chi ha segnato questo prezzo sul listino condiviso, se non sei tu. */
  autore: string
  /** Il prezzo è ancora una tua nota locale: solo quelle si possono togliere. */
  mio: boolean
  storico: { t: number; price: number }[]
  bozza: string
  appenaSalvato: number
  onBozza: (valore: string) => void
  onInvio: () => void
  onSalva: () => void
  onTogli: () => void
  registraCampo: (elemento: HTMLInputElement | null) => void
}) {
  const stato = STATO[voce.stato]
  // La stima serve proprio qui: dice se quello che stai per scrivere è in
  // linea con quanto ci si aspettava, o se il mercato si è mosso davvero.
  const stima =
    voce.prezzo > 0
      ? stimaPrezzo({
          history: storico,
          quote: { price: voce.prezzo, at: voce.osservatoIl },
          now: adesso,
        })
      : null
  const scarto = stima && stima.price > 0 && voce.prezzo > 0 ? stima.price / voce.prezzo - 1 : 0

  return (
    <div className="rounded-xl border border-pitch-line bg-pitch-soft/60 px-3 py-2.5">
      {/* Il nome sta su una riga tutta sua: sul telefono, diviso con il campo,
          verrebbe tagliato dopo tre lettere. */}
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-chalk-dim">{voce.rating || '—'}</span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{voce.name}</span>
        {voce.quantita > 1 ? <span className="text-xs text-chalk-dim">×{voce.quantita}</span> : null}
        <span className="whitespace-nowrap">
          <Pill tone={stato.tone}>{stato.label}</Pill>
        </span>
      </div>

      <div className="mt-1.5 flex items-center gap-2">
        <p className="min-w-0 flex-1 text-[11px] leading-tight text-chalk-dim">
          {voce.prezzo > 0 ? (
            <>
              ultimo {coins(voce.prezzo)} · {anzianita(voce.osservatoIl, adesso)}
              {autore ? ` · da ${autore}` : ''}
              {stima && Math.abs(scarto) >= 0.02 ? ` · stimato ora ${coins(stima.price)}` : ''}
            </>
          ) : (
            'nessun prezzo: scrivi il primo e parte lo storico'
          )}
        </p>
        <input
          ref={registraCampo}
          value={bozza}
          onChange={(event) => onBozza(event.target.value.replace(/[^\d.,kKmM]/g, ''))}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              onInvio()
            }
          }}
          inputMode="decimal"
          enterKeyHint="next"
          placeholder={voce.prezzo > 0 ? coins(voce.prezzo) : 'prezzo'}
          aria-label={`Prezzo di ${voce.name}`}
          className="w-28 shrink-0 rounded-xl border border-pitch-line bg-pitch px-2 py-2 text-right font-mono text-sm outline-none focus:border-gain/60 sm:w-32"
        />
        <button type="button" className={`${buttonClass} shrink-0 px-2.5`} onClick={onSalva} disabled={!bozza.trim()}>
          Salva
        </button>
        {mio ? (
          <button type="button" className="shrink-0 text-xs text-chalk-dim hover:text-loss" onClick={onTogli}>
            togli
          </button>
        ) : null}
      </div>
      {appenaSalvato > 0 ? <p className="mt-1 text-[11px] text-gain">Salvato {coins(appenaSalvato)}.</p> : null}
    </div>
  )
}

/**
 * Le carte che l'app non conosce ancora: si cercano qui e finiscono
 * nell'elenco, senza passare dal Mercato.
 */
function AggiungiCarta({ onAdd, conosciuti }: { onAdd: (player: Player) => void; conosciuti: string[] }) {
  const [query, setQuery] = useState('')
  const [risultati, setRisultati] = useState<Player[]>([])
  const [cercando, setCercando] = useState(false)
  const noti = new Set(conosciuti)

  useEffect(() => {
    const term = query.trim()
    if (term.length < 2) {
      setRisultati([])
      return undefined
    }
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setCercando(true)
      searchPlayers(term, controller.signal)
        .then((risposta) => setRisultati(risposta.players.slice(0, 8)))
        .catch(() => setRisultati([]))
        .finally(() => {
          if (!controller.signal.aborted) setCercando(false)
        })
    }, 350)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  return (
    <Card>
      <CardTitle hint="Cerca una carta e aggiungila all'elenco: da lì in poi ti chiederà il prezzo come le altre.">
        Aggiungi una carta
      </CardTitle>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Es. Lautaro, Bastoni…"
        className="w-full rounded-xl border border-pitch-line bg-pitch px-3 py-2 text-sm outline-none focus:border-gain/60"
      />
      {cercando ? <p className="mt-2 text-xs text-chalk-dim">cerco…</p> : null}
      {risultati.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {risultati.map((player) => (
            <li key={player.id} className="flex items-center gap-2">
              <span className="font-mono text-xs text-chalk-dim">{player.rating}</span>
              <span className="flex-1 truncate text-sm">{player.name}</span>
              {noti.has(player.id) ? (
                <span className="text-xs text-chalk-dim">già nell'elenco</span>
              ) : (
                <button
                  type="button"
                  className={buttonClass}
                  onClick={() => {
                    onAdd(player)
                    setQuery('')
                    setRisultati([])
                  }}
                >
                  Aggiungi
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  )
}
