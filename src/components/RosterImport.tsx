import { useState } from 'react'

import { MAX_RIGHE_IMPORT, parseRoster, pickBestMatch } from '../../shared/roster-import.mjs'
import { searchPlayers } from '../lib/api.ts'
import { useStore } from '../lib/useStore.ts'
import { Card, CardTitle, buttonClass, primaryButtonClass } from './ui.tsx'

/**
 * Importazione della rosa incollando un elenco. Ogni nome viene cercato sulla
 * sorgente dati per collegarlo a un prezzo: senza collegamento la carta si
 * registra lo stesso, ma resta senza quotazione.
 */
export default function RosterImport() {
  const { settings, addPosition, rememberPlayer } = useStore()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [report, setReport] = useState<string | null>(null)

  const righe = parseRoster(text)

  const importa = async () => {
    if (righe.length === 0) return
    setBusy(true)
    setReport(null)
    setProgress({ done: 0, total: righe.length })
    let collegate = 0
    let scollegate = 0

    for (const [indice, riga] of righe.entries()) {
      let player = null
      try {
        const risposta = await searchPlayers(riga.name)
        player = pickBestMatch(riga.name, risposta.players)
      } catch {
        player = null
      }
      if (player) {
        collegate += 1
        rememberPlayer(player)
      } else {
        scollegate += 1
      }
      addPosition({
        playerId: player?.id ?? '',
        name: player?.name ?? riga.name,
        rating: player?.rating ?? 0,
        quantity: riga.quantity,
        buyPrice: riga.buyPrice,
        platform: settings.platform,
        note: 'importata dalla rosa',
      })
      setProgress({ done: indice + 1, total: righe.length })
    }

    setBusy(false)
    setText('')
    setReport(
      `${collegate + scollegate} carte aggiunte${scollegate > 0 ? `, di cui ${scollegate} senza quotazione (nome non trovato)` : ''}.`,
    )
  }

  return (
    <Card>
      <CardTitle hint="Una carta per riga. Quantità e prezzo pagato sono facoltativi: «Lautaro x2 150k» va benissimo.">
        Importa la rosa
      </CardTitle>
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={5}
        placeholder={'Lautaro Martinez x2 150k\nBastoni 44000\nRafael Leao, 1, 58000'}
        className="w-full rounded-xl border border-pitch-line bg-pitch px-3 py-2 font-mono text-sm outline-none focus:border-gain/60"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" className={primaryButtonClass} disabled={righe.length === 0 || busy} onClick={() => void importa()}>
          {busy ? `Importo… ${progress.done}/${progress.total}` : `Importa ${righe.length || ''} carte`.trim()}
        </button>
        {text ? (
          <button type="button" className={buttonClass} disabled={busy} onClick={() => setText('')}>
            Svuota
          </button>
        ) : null}
        <span className="text-xs text-chalk-dim">massimo {MAX_RIGHE_IMPORT} righe per volta</span>
      </div>
      {righe.length > 0 && !busy ? (
        <p className="mt-2 text-xs text-chalk-dim">
          Leggo: {righe.slice(0, 4).map((riga) => `${riga.name}${riga.quantity > 1 ? ` ×${riga.quantity}` : ''}`).join(' · ')}
          {righe.length > 4 ? ` … e altre ${righe.length - 4}` : ''}
        </p>
      ) : null}
      {report ? <p className="mt-2 text-xs text-gain">{report}</p> : null}
    </Card>
  )
}
