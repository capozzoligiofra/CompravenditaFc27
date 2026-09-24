import { useRef, useState } from 'react'

import { Card, CardTitle, buttonClass, primaryButtonClass } from './ui.tsx'
import { leggiCsv } from '../../shared/catalog.mjs'
import type { CartaBase } from '../../shared/catalog.d.mts'
import { useStore } from '../lib/useStore.ts'

const MAX_CARTE = 40_000

/**
 * Il catalogo dei giocatori, da un file tuo.
 *
 * L'app non porta con sé l'elenco completo dei giocatori — non esiste una
 * fonte che ce lo conceda — ma se ce l'hai già, in un CSV esportato o in un
 * foglio, lo carichi qui e da quel momento la ricerca li trova tutti e gli
 * import riconoscono i nomi invece di creare carte nuove.
 *
 * Il catalogo è solo un elenco di nomi: non sono «carte che segui» e non
 * riempiono il pannello dei prezzi. Resta su questo dispositivo.
 */
export default function CatalogImport() {
  const { catalogo, aggiungiAlCatalogo, svuotaCatalogo } = useStore()
  const fileInput = useRef<HTMLInputElement>(null)
  const [messaggio, setMessaggio] = useState<string | null>(null)
  const [errore, setErrore] = useState<string | null>(null)
  const [lavorando, setLavorando] = useState(false)

  const quante = Object.keys(catalogo).length

  const carica = (testo: string) => {
    setLavorando(true)
    setErrore(null)
    setMessaggio(null)
    // Un file grande blocca il filo dell'interfaccia per qualche decimo di
    // secondo: si lascia respirare il browser prima di macinare.
    setTimeout(() => {
      const esito = leggiCsv(testo)
      if (esito.errore) {
        setErrore(esito.errore)
        setLavorando(false)
        return
      }
      const carte = (esito.carte as CartaBase[]).slice(0, MAX_CARTE)
      const { aggiunte, salvato } = aggiungiAlCatalogo(carte)
      const colonne = esito.colonne
        ? `Colonne usate: «${esito.colonne.nome}»${esito.colonne.valutazione ? ` e «${esito.colonne.valutazione}»` : ' (nessuna valutazione)'}.`
        : ''
      setMessaggio(
        `${carte.length} carte lette, ${aggiunte} nuove nel catalogo${esito.scartate > 0 ? `, ${esito.scartate} righe scartate` : ''}. ${colonne}`,
      )
      if (!salvato) {
        setErrore(
          'Il browser non ha spazio per tenere tutto il catalogo: vale per questa sessione, ma alla prossima apertura ne ritroverai meno. Prova con un file più piccolo.',
        )
      }
      setLavorando(false)
    }, 30)
  }

  return (
    <Card>
      <CardTitle hint="Un file CSV con i nomi dei giocatori e, se c'è, la valutazione. Serve a far trovare le carte alla ricerca e a far riconoscere i nomi negli elenchi di prezzi.">
        Catalogo dei giocatori
      </CardTitle>

      <p className="text-sm text-chalk-dim">
        {quante > 0
          ? `${quante.toLocaleString('it-IT')} carte nel catalogo di questo dispositivo.`
          : 'Catalogo vuoto: la ricerca trova solo le carte che tu e il listino avete già creato.'}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={primaryButtonClass} disabled={lavorando} onClick={() => fileInput.current?.click()}>
          {lavorando ? 'Leggo il file…' : 'Carica un CSV'}
        </button>
        {quante > 0 ? (
          <button
            type="button"
            className={buttonClass}
            onClick={() => {
              if (confirm('Svuotare il catalogo? Le carte che segui e i prezzi restano.')) {
                svuotaCatalogo()
                setMessaggio('Catalogo svuotato.')
              }
            }}
          >
            Svuota il catalogo
          </button>
        ) : null}
        <input
          ref={fileInput}
          type="file"
          accept=".csv,.txt,text/csv,text/plain"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (!file) return
            file
              .text()
              .then(carica)
              .catch(() => setErrore('Non riesco a leggere il file.'))
          }}
        />
      </div>

      {messaggio ? <p className="mt-2 text-xs text-gain">{messaggio}</p> : null}
      {errore ? <p className="mt-2 text-xs text-loss">{errore}</p> : null}

      <p className="mt-3 text-[11px] text-chalk-dim">
        Vanno bene virgola, punto e virgola o tabulazione, intestazioni in italiano o in inglese
        (<code className="font-mono">nome/name</code>, <code className="font-mono">valutazione/rating/overall</code>) e,
        se l'intestazione manca, le prime due colonne. Il catalogo resta su questo dispositivo: non viene mandato al
        listino né agli altri. Le carte entrano nel listino solo quando qualcuno ci mette un prezzo.
      </p>
    </Card>
  )
}
