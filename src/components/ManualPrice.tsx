import { useEffect, useState } from 'react'

import { coins } from '../lib/format.ts'
import { useStore } from '../lib/useStore.ts'
import { buttonClass } from './ui.tsx'

/**
 * Campo per scrivere il prezzo letto in gioco. Serve quando la sorgente
 * automatica non risponde: con il prezzo a mano margini, target e verdetti
 * di vendita tornano a funzionare come se arrivasse da Futbin.
 */
export default function ManualPrice({ playerId, compact = false }: { playerId: string; compact?: boolean }) {
  const { data, setManualPrice } = useStore()
  const salvato = data.manualPrices[playerId]
  const [value, setValue] = useState(() => (salvato ? String(salvato.price) : ''))

  useEffect(() => {
    setValue(salvato ? String(salvato.price) : '')
  }, [salvato?.price, salvato])

  if (!playerId) {
    return <p className="text-xs text-chalk-dim">Carta non collegata a un giocatore: il prezzo non si può salvare.</p>
  }

  const salva = () => setManualPrice(playerId, Number.parseInt(value, 10) || 0)

  return (
    <div className={compact ? '' : 'rounded-xl border border-pitch-line bg-pitch/60 p-3'}>
      {!compact ? (
        <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-chalk-dim">Prezzo visto in gioco</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={value}
          onChange={(event) => setValue(event.target.value.replace(/[^\d]/g, ''))}
          onKeyDown={(event) => {
            if (event.key === 'Enter') salva()
          }}
          inputMode="numeric"
          placeholder="es. 42000"
          className="w-32 rounded-xl border border-pitch-line bg-pitch px-3 py-2 font-mono text-sm outline-none focus:border-gain/60"
        />
        <button type="button" className={buttonClass} onClick={salva}>
          Salva
        </button>
        {salvato ? (
          <button
            type="button"
            className="text-xs text-chalk-dim hover:text-loss"
            onClick={() => {
              setValue('')
              setManualPrice(playerId, 0)
            }}
          >
            togli
          </button>
        ) : null}
      </div>
      {salvato ? (
        <p className="mt-1 text-[11px] text-chalk-dim">
          Salvato {coins(salvato.price)} il {new Date(salvato.at).toLocaleDateString('it-IT')}: viene usato finché non
          arriva un prezzo vero.
        </p>
      ) : (
        <p className="mt-1 text-[11px] text-chalk-dim">
          Se la sorgente automatica è bloccata, scrivi qui il prezzo che vedi in gioco: i calcoli lo useranno.
        </p>
      )}
    </div>
  )
}
