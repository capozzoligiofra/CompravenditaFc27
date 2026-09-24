import { useMemo, useState } from 'react'

import { Card, CardTitle, buttonClass, primaryButtonClass } from './ui.tsx'
import { leggiElencoJson } from '../../shared/price-json.mjs'
import type { VoceJson } from '../../shared/price-json.d.mts'
import { riassuntoImport, useApplicaPrezzi } from '../lib/importa.ts'
import { coins } from '../lib/format.ts'

const ESEMPIO = `[
  { "nome": "Klara Bühl", "prezzo": "8.2K" },
  { "nome": "Alessia Russo", "prezzo": "14K" }
]`

/**
 * Prezzi da un elenco JSON.
 *
 * Stesso mestiere dell'elenco riga per riga, per chi i prezzi li tiene in un
 * foglio o in un file: si incolla, si guarda cosa ha capito l'app, e solo
 * dopo si applica. L'anteprima non è un vezzo — un import silenzioso che
 * sbaglia metà dei nomi fa più danno di uno che non parte.
 */
export default function JsonPriceImport() {
  const { prepara, applica } = useApplicaPrezzi()
  const [testo, setTesto] = useState('')
  const [applicato, setApplicato] = useState<string | null>(null)

  const lettura = useMemo(() => leggiElencoJson(testo), [testo])
  const preparate = useMemo(() => prepara(lettura.voci as VoceJson[]), [prepara, lettura.voci])

  const valide = preparate.filter((riga) => riga.player)
  const nuove = valide.filter((riga) => riga.nuova).length

  const applicaTutto = () => {
    setApplicato(`${riassuntoImport(applica(valide))} Con il listino collegato partono anche agli altri.`)
    setTesto('')
  }

  return (
    <Card>
      <CardTitle hint="Un elenco di prezzi in JSON: nome e prezzo per ogni carta. Vanno bene 8.2K, 14K, 1,2M o 44000, le chiavi in italiano o in inglese, e anche solo il pezzo copiato in mezzo all'elenco.">
        Prezzi da un elenco JSON
      </CardTitle>

      <textarea
        value={testo}
        onChange={(event) => {
          setTesto(event.target.value)
          setApplicato(null)
        }}
        rows={6}
        placeholder={ESEMPIO}
        spellCheck={false}
        className="w-full rounded-xl border border-pitch-line bg-pitch px-3 py-2 font-mono text-xs outline-none focus:border-gain/60"
      />

      {lettura.errore ? <p className="mt-2 text-xs text-loss">{lettura.errore}</p> : null}

      {valide.length > 0 ? (
        <>
          <p className="mt-2 text-xs text-chalk-dim">
            {valide.length} carte lette{nuove > 0 ? ` · ${nuove} da creare` : ''}
            {lettura.scartate > 0 ? ` · ${lettura.scartate} righe scartate (senza nome o senza prezzo)` : ''}
            {lettura.duplicate > 0 ? ` · ${lettura.duplicate} doppioni ignorati` : ''}
          </p>

          <ul className="mt-2 max-h-56 divide-y divide-pitch-line overflow-y-auto rounded-xl border border-pitch-line">
            {valide.slice(0, 40).map((riga) => (
              <li key={riga.player?.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                <span className="w-8 shrink-0 font-mono text-xs text-chalk-dim">{riga.player?.rating || '—'}</span>
                <span className="min-w-0 flex-1 truncate">{riga.player?.name}</span>
                {riga.nuova ? <span className="text-[11px] text-flag">nuova</span> : null}
                <span className="font-mono">{coins(riga.voce.price)}</span>
              </li>
            ))}
          </ul>
          {valide.length > 40 ? (
            <p className="mt-1 text-[11px] text-chalk-dim">…e altre {valide.length - 40}.</p>
          ) : null}

          <button type="button" className={`${primaryButtonClass} mt-3`} onClick={applicaTutto}>
            Applica {valide.length} {valide.length === 1 ? 'prezzo' : 'prezzi'}
          </button>
        </>
      ) : null}

      {applicato ? <p className="mt-2 text-xs text-gain">{applicato}</p> : null}

      {!testo ? (
        <button
          type="button"
          className={`${buttonClass} mt-2`}
          onClick={() => setTesto(ESEMPIO)}
        >
          Mostrami un esempio
        </button>
      ) : null}

      <p className="mt-3 text-[11px] text-chalk-dim">
        I prezzi entrano come osservazioni tue, con la data di adesso, e portano il tuo nome nel listino condiviso: mettici
        dentro solo cifre di cui ti fidi, perché gli altri le vedranno firmate da te.
      </p>
    </Card>
  )
}
