import { useRef, useState } from 'react'

import { Card, CardTitle, NumberField, Pill, buttonClass } from '../components/ui.tsx'
import { getCustomApiBase, setCustomApiBase } from '../lib/apiBase.ts'
import { exportData, importData } from '../lib/storage.ts'
import { useHealth } from '../lib/useHealth.ts'
import { useStore } from '../lib/useStore.ts'
import type { Platform } from '../types.ts'

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'ps', label: 'PlayStation' },
  { value: 'xbox', label: 'Xbox' },
  { value: 'pc', label: 'PC' },
]

export default function SettingsPage() {
  const { data, settings, updateSettings, replaceAll, reset } = useStore()
  const { health, error } = useHealth()
  const fileInput = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [apiBase, setApiBase] = useState(() => getCustomApiBase())

  const download = () => {
    const blob = new Blob([exportData(data)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `fc27-trader-backup-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const upload = (file: File) => {
    file
      .text()
      .then((raw) => {
        replaceAll(importData(raw))
        setMessage('Backup importato.')
      })
      .catch(() => setMessage('File non valido: atteso un backup JSON di FC27 Trader.'))
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardTitle hint="Valori usati da tutti i calcoli dell'app.">Parametri di trading</CardTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label>
            <span className="text-[11px] uppercase tracking-[0.14em] text-chalk-dim">Piattaforma</span>
            <select
              value={settings.platform}
              onChange={(event) => updateSettings({ platform: event.target.value as Platform })}
              className="mt-1 w-full rounded-xl border border-pitch-line bg-pitch px-3 py-2 text-sm outline-none focus:border-gain/60"
            >
              {PLATFORMS.map((platform) => (
                <option key={platform.value} value={platform.value}>
                  {platform.label}
                </option>
              ))}
            </select>
          </label>
          <NumberField
            label="Tassa EA sulle vendite"
            value={settings.taxPercent}
            step={0.5}
            suffix="%"
            onChange={(value) => updateSettings({ taxPercent: value })}
            hint="Nel gioco è il 5%: cambiala solo se EA la modifica."
          />
          <NumberField
            label="Margine obiettivo"
            value={settings.targetMarginPercent}
            step={1}
            suffix="%"
            onChange={(value) => updateSettings({ targetMarginPercent: value })}
            hint="Usato per calcolare il BIN massimo consigliato."
          />
          <NumberField
            label="Budget disponibile"
            value={settings.budget}
            step={1000}
            suffix="cr"
            onChange={(value) => updateSettings({ budget: value })}
            hint="Serve a stimare quante carte puoi comprare."
          />
        </div>
      </Card>

      <Card>
        <CardTitle hint="L'app non parla mai con Futbin dal browser: passa sempre da un proxy, che limita le richieste e mette in cache le risposte.">
          Sorgente dati
        </CardTitle>
        {error || !health ? (
          <div className="space-y-2 text-sm">
            <Pill tone="loss">sorgente non disponibile</Pill>
            <p className="text-chalk-dim">Ricarica la pagina: non riesco nemmeno a leggere i dati demo.</p>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone={health.mode === 'statico' ? 'flag' : health.futbin.reachable === true ? 'gain' : 'flag'}>
                {health.mode === 'statico'
                  ? 'versione statica'
                  : health.futbin.enabled
                    ? health.futbin.reachable === false
                      ? 'fallback demo'
                      : 'Futbin attivo'
                    : 'Futbin disattivato'}
              </Pill>
              <span className="text-chalk-dim">
                {health.mode === 'statico'
                  ? `${health.demoPlayers} giocatori nel dataset demo incluso nell’app`
                  : `anno gioco FC${health.futbin.year} · ${health.demoPlayers} giocatori nel dataset demo`}
              </span>
            </div>

            {health.mode === 'statico' ? (
              <p className="text-chalk-dim">
                Qui non c’è nessun proxy dati, quindi i prezzi mostrati sono quelli del dataset demo: calcolatore,
                watchlist e portafoglio funzionano comunque, perché i conti si fanno nel telefono. Per i prezzi veri di
                Futbin serve il proxy, avviato sul computer con <code className="font-mono text-chalk">npm run mobile</code>.
              </p>
            ) : null}

            {health.lastError && health.mode !== 'statico' ? (
              <p className="text-xs text-flag">
                Ultimo errore: {health.lastError}
                {health.lastErrorAt ? ` (${new Date(health.lastErrorAt).toLocaleString('it-IT')})` : ''}
                {health.retryInSeconds > 0 ? ` · nuovo tentativo fra ${health.retryInSeconds}s` : ''}
              </p>
            ) : null}

            <div className="border-t border-pitch-line pt-3">
              <label className="block">
                <span className="text-[11px] uppercase tracking-[0.14em] text-chalk-dim">
                  Indirizzo del proxy dati (facoltativo)
                </span>
                <input
                  value={apiBase}
                  onChange={(event) => setApiBase(event.target.value)}
                  placeholder="/api"
                  className="mt-1 w-full rounded-xl border border-pitch-line bg-pitch px-3 py-2 font-mono text-sm outline-none focus:border-gain/60"
                />
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className={buttonClass}
                  onClick={() => {
                    setCustomApiBase(apiBase)
                    setMessage('Indirizzo salvato: ricarica la pagina per usarlo.')
                  }}
                >
                  Salva indirizzo
                </button>
                <button
                  type="button"
                  className={buttonClass}
                  onClick={() => {
                    setApiBase('')
                    setCustomApiBase('')
                    setMessage('Torno all’indirizzo predefinito (/api).')
                  }}
                >
                  Ripristina
                </button>
              </div>
              <p className="mt-2 text-xs text-chalk-dim">
                Serve solo se il proxy gira altrove rispetto all’app. Attenzione: se questa pagina è aperta in https
                (per esempio su GitHub Pages) il browser blocca gli indirizzi http, quindi il proxy dovrebbe essere
                raggiungibile anch’esso in https.
              </p>
            </div>

            <p className="text-xs text-chalk-dim">
              Futbin non ha un’API pubblica: se cambiano gli endpoint puoi sovrascriverli con le variabili
              d’ambiente <code className="font-mono">FUTBIN_SEARCH_URL</code>,{' '}
              <code className="font-mono">FUTBIN_PRICES_URL</code>, <code className="font-mono">FUTBIN_GRAPH_URL</code>{' '}
              e <code className="font-mono">FC27_YEAR</code>. Con{' '}
              <code className="font-mono">FUTBIN_ENABLED=false</code> il proxy lavora solo sul dataset demo.
            </p>
          </div>
        )}
      </Card>

      <Card>
        <CardTitle hint="Watchlist, portafoglio e impostazioni vivono solo in questo browser. Nessun account, nessun server.">
          Dati locali
        </CardTitle>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={buttonClass} onClick={download}>
            Esporta backup
          </button>
          <button type="button" className={buttonClass} onClick={() => fileInput.current?.click()}>
            Importa backup
          </button>
          <button
            type="button"
            className={buttonClass}
            onClick={() => {
              if (confirm('Cancellare watchlist, portafoglio e impostazioni?')) {
                reset()
                setMessage('Dati azzerati.')
              }
            }}
          >
            Azzera tutto
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) upload(file)
              event.target.value = ''
            }}
          />
        </div>
        {message ? <p className="mt-2 text-xs text-gain">{message}</p> : null}
        <p className="mt-3 text-xs text-chalk-dim">
          {data.watchlist.length} {data.watchlist.length === 1 ? 'giocatore' : 'giocatori'} in watchlist ·{' '}
          {data.positions.length} {data.positions.length === 1 ? 'posizione registrata' : 'posizioni registrate'}
        </p>
      </Card>

      <Card>
        <CardTitle>Nota d'uso</CardTitle>
        <p className="text-sm text-chalk-dim">
          FC27 Trader è uno strumento personale di analisi: legge i prezzi pubblici, li mette in cache e fa i conti
          al posto tuo. Non automatizza acquisti o vendite in gioco e non si collega al tuo account EA. Le richieste
          a Futbin sono limitate (una alla volta, con pausa e cache) per non pesare sul servizio: rispetta i loro
          termini d'uso e tienile a un ritmo umano.
        </p>
      </Card>
    </div>
  )
}
