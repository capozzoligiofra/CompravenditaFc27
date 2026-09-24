import { useMemo, useState } from 'react'

import { parsePriceList } from '../../shared/roster-import.mjs'
import { riassuntoImport, useApplicaPrezzi } from '../lib/importa.ts'
import { Card, CardTitle, primaryButtonClass } from './ui.tsx'

/**
 * Aggiornamento dei prezzi in blocco: una riga per carta, nome e prezzo.
 *
 * Le carte che non esistono ancora vengono create: il catalogo lo costruite
 * voi mentre lo usate, quindi un nome sconosciuto è la regola, non l'errore.
 */
export default function PriceListImport() {
  const { prepara, applica } = useApplicaPrezzi()
  const [text, setText] = useState('')
  const [report, setReport] = useState<string | null>(null)

  const righe = useMemo(() => prepara(parsePriceList(text)), [prepara, text])
  const nuove = righe.filter((riga) => riga.nuova).length

  return (
    <Card>
      <CardTitle hint="Una riga per carta: nome e prezzo. Le carte che l'app non conosce ancora vengono create.">
        Aggiorna i prezzi in blocco
      </CardTitle>
      <textarea
        value={text}
        onChange={(event) => {
          setText(event.target.value)
          setReport(null)
        }}
        rows={4}
        placeholder={'Lautaro Martinez 150k\nBastoni 44000\nRafael Leao 58000'}
        className="w-full rounded-xl border border-pitch-line bg-pitch px-3 py-2 font-mono text-sm outline-none focus:border-gain/60"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={primaryButtonClass}
          disabled={righe.length === 0}
          onClick={() => {
            setReport(riassuntoImport(applica(righe)))
            setText('')
          }}
        >
          Aggiorna {righe.length || ''} {righe.length === 1 ? 'prezzo' : 'prezzi'}
        </button>
        {righe.length > 0 ? (
          <span className="text-xs text-chalk-dim">
            {nuove > 0 ? `${nuove} carte da creare` : 'tutte già conosciute'}
          </span>
        ) : null}
      </div>
      {report ? <p className="mt-2 text-xs text-gain">{report}</p> : null}
    </Card>
  )
}
