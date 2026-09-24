import { useEffect, useMemo, useState } from 'react'

import ManualPrice from './ManualPrice.tsx'
import PriceEstimate from './PriceEstimate.tsx'
import Sparkline from './Sparkline.tsx'
import { Card, CardTitle, Pill, Stat, buttonClass, primaryButtonClass } from './ui.tsx'
import { getPlayer } from '../lib/api.ts'
import { coins } from '../lib/format.ts'
import { breakEvenSell, maxBuyForMargin, roundToMarketStep, sellForMargin } from '../../shared/market.mjs'
import { isLiveSource, mergeQuotes } from '../../shared/quotes.mjs'
import { useStore } from '../lib/useStore.ts'
import type { Player, PlayerDetail, Quote } from '../types.ts'

const PLATFORM_LABEL = { ps: 'PlayStation', xbox: 'Xbox', pc: 'PC' } as const

/**
 * La scheda di una carta: quello che si sa di lei e tutto quello che ci si
 * può fare. È una sola, e si apre da ogni nome che compare nell'app — dal
 * pannello dei prezzi, dalla watchlist, dalla rosa, dalle proposte.
 *
 * Deve funzionare anche per una carta che la sorgente non conosce: con il
 * listino condiviso può arrivare il prezzo di un giocatore che il dataset
 * locale non ha mai visto, e in quel caso l'anagrafica la mettono insieme i
 * dati che l'app ha già (rosa, watchlist, listino).
 */
export default function PlayerSheet({ playerId }: { playerId: string }) {
  const { data, settings, prezzi, addWatch, isWatched, addPosition, rememberPlayer } = useStore()
  const [detail, setDetail] = useState<PlayerDetail | null>(null)
  const [caricando, setCaricando] = useState(true)
  const [errore, setErrore] = useState<string | null>(null)
  const [valutazione, setValutazione] = useState('')
  const [correggo, setCorreggo] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    setCaricando(true)
    setDetail(null)
    getPlayer(playerId, settings.platform, controller.signal)
      .then(setDetail)
      .catch((causa: unknown) => {
        if (!controller.signal.aborted) setErrore(causa instanceof Error ? causa.message : 'Errore di rete')
      })
      .finally(() => {
        if (!controller.signal.aborted) setCaricando(false)
      })
    return () => controller.abort()
  }, [playerId, settings.platform])

  // L'identità della carta: prima quella della sorgente, poi quello che
  // sappiamo già. Una carta senza nome non si guarda volentieri.
  const player = useMemo<Player | null>(() => {
    if (detail?.player) return detail.player
    const visto = data.seen.find((voce) => voce.id === playerId)
    if (visto) return visto
    const inLista = data.watchlist.find((voce) => voce.id === playerId)
    if (inLista) {
      return { id: playerId, name: inLista.name, rating: inLista.rating, position: inLista.position, club: inLista.club, league: '', nation: '', version: '', image: '' }
    }
    const inRosa = data.positions.find((voce) => voce.playerId === playerId)
    if (inRosa) {
      return { id: playerId, name: inRosa.name, rating: inRosa.rating, position: '', club: '', league: '', nation: '', version: '', image: '' }
    }
    const dalListino = data.sharedPlayers[playerId]
    if (dalListino) {
      return { id: playerId, name: dalListino.name, rating: dalListino.rating, position: '', club: '', league: '', nation: '', version: '', image: '' }
    }
    return null
  }, [detail, data.seen, data.watchlist, data.positions, data.sharedPlayers, playerId])

  // Aprire una scheda vuol dire seguire quella carta: da qui in poi comparirà
  // nel pannello dei prezzi e fra le proposte. Le carte seguite sono tue,
  // anche quando il listino dei prezzi è di tutti.
  useEffect(() => {
    if (player?.name) rememberPlayer(player)
  }, [player, rememberPlayer])

  const quote = useMemo(() => {
    const dalla = detail?.prices?.[settings.platform] ?? null
    const unite = mergeQuotes({ [playerId]: dalla }, prezzi, detail?.source ?? 'locale') as Record<string, Quote | null>
    return unite[playerId] ?? null
  }, [detail, settings.platform, prezzi, playerId])

  // Lo storico della sorgente vale solo se la sorgente vale: altrimenti
  // conta solo quello che avete osservato voi.
  const storico =
    isLiveSource(detail?.source) && detail?.history?.length ? detail.history : (data.priceHistory[playerId] ?? [])
  const price = quote?.price ?? 0
  const maxBuy = price ? roundToMarketStep(maxBuyForMargin(price, settings.targetMarginPercent, settings.taxPercent)) : 0
  const sellTarget = price ? sellForMargin(price, settings.targetMarginPercent, settings.taxPercent) : 0
  const inRosa = data.positions.filter((voce) => voce.playerId === playerId && voce.sellPrice == null)

  if (caricando && !player) {
    return (
      <Card>
        <p className="text-sm text-chalk-dim">Carico la carta…</p>
      </Card>
    )
  }

  if (!player) {
    return (
      <Card>
        <CardTitle>Carta sconosciuta</CardTitle>
        <p className="text-sm text-chalk-dim">
          Di questa carta l'app non sa niente: né la sorgente né il listino la conoscono. Cercala dal Mercato per
          nome, così entra fra quelle che segui.
        </p>
        {errore ? <p className="mt-2 text-xs text-loss">{errore}</p> : null}
      </Card>
    )
  }

  const caratteristiche = [
    ['Ruolo', player.position],
    ['Club', player.club],
    ['Campionato', player.league],
    ['Nazione', player.nation],
    ['Versione', player.version],
  ].filter(([, valore]) => Boolean(valore))

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="w-10 shrink-0 rounded-lg bg-flag/15 py-1 text-center font-mono text-base font-bold text-flag">
                {player.rating || '—'}
              </span>
              <h2 className="truncate text-lg font-semibold">{player.name}</h2>
            </div>
            {/* Una carta creata da un elenco può arrivare senza valutazione, e
                senza quella i segnali sul fodder non funzionano: si corregge
                qui, senza cambiare carta. */}
            {correggo ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  value={valutazione}
                  onChange={(event) => setValutazione(event.target.value.replace(/[^\d]/g, '').slice(0, 2))}
                  inputMode="numeric"
                  placeholder="es. 84"
                  aria-label="Valutazione"
                  className="w-20 rounded-xl border border-pitch-line bg-pitch px-2 py-1.5 text-center font-mono text-sm outline-none focus:border-gain/60"
                />
                <button
                  type="button"
                  className={buttonClass}
                  onClick={() => {
                    const voto = Number(valutazione)
                    if (voto > 0) rememberPlayer({ ...player, rating: Math.min(99, voto) })
                    setCorreggo(false)
                  }}
                >
                  Salva valutazione
                </button>
                <button type="button" className="text-xs text-chalk-dim" onClick={() => setCorreggo(false)}>
                  annulla
                </button>
              </div>
            ) : (
              <button
                type="button"
                className={player.rating ? 'mt-1 text-[11px] text-chalk-dim hover:text-chalk' : 'mt-1 text-xs text-flag'}
                onClick={() => {
                  setValutazione(player.rating ? String(player.rating) : '')
                  setCorreggo(true)
                }}
              >
                {player.rating ? 'correggi la valutazione' : 'valutazione mancante: scrivila'}
              </button>
            )}

            {caratteristiche.length > 0 ? (
              <p className="mt-1 text-xs text-chalk-dim">
                {caratteristiche.map(([, valore]) => valore).join(' · ')}
              </p>
            ) : (
              <p className="mt-1 text-xs text-chalk-dim">
                Di questa carta conosciamo solo nome e valutazione: il resto arriverebbe da una sorgente automatica.
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {detail?.fromCache ? <Pill tone="flag">offline</Pill> : null}
            <Pill tone={isLiveSource(detail?.source) ? 'gain' : 'flag'}>
              {detail?.source === 'api' ? 'API' : detail?.source === 'futbin' ? 'Futbin' : 'prezzi vostri'}
            </Pill>
            <Pill>{PLATFORM_LABEL[settings.platform]}</Pill>
            {inRosa.length > 0 ? <Pill tone="gain">in rosa ×{inRosa.reduce((n, v) => n + v.quantity, 0)}</Pill> : null}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat
            label="Prezzo attuale"
            value={coins(price)}
            hint={detail?.fromCache && !quote?.manual ? 'prezzo salvato, sei offline' : quote?.updated}
          />
          <Stat label="Min 24h" value={coins(quote?.minPrice ?? 0)} />
          <Stat label="Max 24h" value={coins(quote?.maxPrice ?? 0)} />
          <Stat
            label="Variazione"
            value={quote?.changePercent ? `${quote.changePercent > 0 ? '+' : ''}${quote.changePercent}%` : '—'}
            tone={(quote?.changePercent ?? 0) > 0 ? 'gain' : (quote?.changePercent ?? 0) < 0 ? 'loss' : 'neutral'}
          />
        </div>

        <div className="mt-4">
          <Sparkline points={storico} />
        </div>
      </Card>

      <Card>
        <CardTitle hint="Il prezzo che scrivi qui vale per tutti quelli collegati al listino, e porta il tuo nome.">
          Aggiorna il prezzo
        </CardTitle>
        <ManualPrice playerId={playerId} compact />
        {isLiveSource(detail?.source) ? (
          <p className="mt-2 text-[11px] text-chalk-dim">
            La sorgente automatica sta rispondendo: finché lo fa, il suo prezzo ha la precedenza su quello scritto a
            mano.
          </p>
        ) : null}
        <div className="mt-3">
          <PriceEstimate history={storico} quote={quote} osservatoIl={prezzi[playerId]?.at} />
        </div>
      </Card>

      <Card>
        <CardTitle hint={`Conti fatti sul margine obiettivo del ${settings.targetMarginPercent}% e sulla tassa del ${settings.taxPercent}%.`}>
          Piano di trade
        </CardTitle>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Stat label="Compra entro" value={coins(maxBuy)} hint="da usare come BIN massimo nel filtro" />
          <Stat label="Rivendi a" value={coins(sellTarget)} hint={`tassa ${settings.taxPercent}% inclusa`} />
          <Stat
            label="Pareggio"
            value={coins(breakEvenSell(price, settings.taxPercent))}
            hint="sotto questo prezzo ci rimetti"
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className={primaryButtonClass}
            disabled={isWatched(playerId)}
            onClick={() =>
              addWatch({
                id: playerId,
                name: player.name,
                rating: player.rating,
                position: player.position,
                club: player.club,
                buyTarget: maxBuy,
                sellTarget,
                note: '',
              })
            }
          >
            {isWatched(playerId) ? 'Già in watchlist' : 'Aggiungi alla watchlist'}
          </button>
          <button
            type="button"
            className={buttonClass}
            disabled={!price}
            onClick={() =>
              addPosition({
                playerId,
                name: player.name,
                rating: player.rating,
                quantity: 1,
                buyPrice: price,
                platform: settings.platform,
                note: 'aggiunto dalla scheda',
              })
            }
          >
            Registra acquisto a {coins(price)}
          </button>
        </div>

        {detail?.reason ? <p className="mt-3 text-[11px] text-chalk-dim">Nota sorgente: {detail.reason}</p> : null}
      </Card>
    </div>
  )
}
