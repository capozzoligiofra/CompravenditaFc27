import { useEffect, useRef, useState } from 'react'

import { Card, CardTitle } from './ui.tsx'
import { unisciCarte } from '../lib/cloud.ts'
import { useDoppioni } from '../lib/useDoppioni.ts'
import { useStore } from '../lib/useStore.ts'

/** Quante coppie per richiesta: il server ne accetta mille, si sta larghi. */
const PER_INVIO = 500

/**
 * I doppioni, e come spariscono.
 *
 * Prima che esistesse il catalogo, incollare un prezzo per un nome mai visto
 * creava una carta senza valutazione: era l'unico posto dove metterlo. Poi è
 * arrivato il catalogo con lo stesso giocatore e il suo voto vero, e siccome
 * l'identificativo si calcola da nome **e** valutazione, adesso sono due
 * carte. Nel pannello dei prezzi si vede la stessa persona due volte, e il
 * prezzo sta su quella sbagliata.
 *
 * Si uniscono da sole, appena l'app se ne accorge: non c'è niente da
 * decidere, il segnaposto non ha nulla di suo oltre al nome, e il prezzo, lo
 * storico e i target passano sulla carta buona. Quello che invece non si
 * indovina resta qui sotto, scritto: «Vitinha 90» e «Vitinha 75» sono due
 * persone diverse, e scegliere per te vorrebbe dire spostare un prezzo sulla
 * carta sbagliata per tutto il gruppo.
 */
export default function Duplicates() {
  const { account, unisciDoppioni } = useStore()
  const { unioni, ambigui } = useDoppioni()
  const [fatto, setFatto] = useState<number>(0)
  const [problema, setProblema] = useState<string | null>(null)
  // Le coppie già viste: una volta sistemata, una coppia non si rifà. Senza
  // questo, una carta che l'unione non riesce a togliere di mezzo terrebbe
  // l'app a girare su se stessa.
  const gestite = useRef(new Set<string>())
  const inviate = useRef(new Set<string>())
  const inCorso = useRef(false)

  useEffect(() => {
    if (unioni.length === 0 || inCorso.current) return
    const nuove = unioni.filter(({ da, a }) => !gestite.current.has(`${da}>${a}`))
    if (nuove.length === 0) return
    inCorso.current = true
    for (const { da, a } of nuove) gestite.current.add(`${da}>${a}`)

    const unite = unisciDoppioni(nuove)
    if (unite > 0) setFatto((precedente) => precedente + unite)

    // Sul server vanno anche le coppie che questo dispositivo aveva già
    // sistemato per conto suo: se il listino non le conosce, alla
    // sincronizzazione dopo il doppione torna giù.
    const daMandare = nuove.filter(({ da, a }) => !inviate.current.has(`${da}>${a}`))
    if (!account || daMandare.length === 0) {
      inCorso.current = false
      return
    }
    for (const { da, a } of daMandare) inviate.current.add(`${da}>${a}`)

    void (async () => {
      try {
        for (let inizio = 0; inizio < daMandare.length; inizio += PER_INVIO) {
          await unisciCarte(account, daMandare.slice(inizio, inizio + PER_INVIO))
        }
        setProblema(null)
      } catch (errore) {
        // Riproveremo: le coppie tolte dall'elenco tornano disponibili.
        for (const { da, a } of daMandare) inviate.current.delete(`${da}>${a}`)
        setProblema(
          `I doppioni sono spariti qui, ma non sul listino: ${errore instanceof Error ? errore.message : 'errore di rete'}. Riprovo da solo.`,
        )
      } finally {
        inCorso.current = false
      }
    })()
  }, [unioni, account, unisciDoppioni])

  if (fatto === 0 && ambigui.length === 0 && !problema) return null

  return (
    <Card>
      <CardTitle hint="Due carte per lo stesso giocatore: succedeva quando un prezzo incollato creava una carta senza valutazione, prima che ci fosse il catalogo.">
        Doppioni
      </CardTitle>

      {fatto > 0 ? (
        <p className="text-sm text-gain">
          {fatto === 1 ? '1 doppione unito' : `${fatto} doppioni uniti`} alla carta con la valutazione giusta. Prezzo,
          storico, target e posizioni sono passati con lui{account ? ', e il listino è stato avvisato' : ''}.
        </p>
      ) : null}

      {problema ? <p className="mt-2 text-xs text-loss">{problema}</p> : null}

      {ambigui.length > 0 ? (
        <>
          <p className="mt-3 text-sm text-chalk-dim">
            {ambigui.length === 1 ? 'Una carta senza valutazione corrisponde' : `${ambigui.length} carte senza valutazione corrispondono`}{' '}
            a più giocatori con lo stesso nome. Non le tocco: apri la scheda e scrivi la valutazione giusta, e il
            doppione si unisce da solo.
          </p>
          <ul className="mt-2 space-y-2">
            {ambigui.map((voce) => (
              <li key={voce.id} className="text-xs text-chalk-dim">
                <span className="text-chalk">{voce.nome}</span> — potrebbe essere{' '}
                {voce.candidati
                  .map((candidato) => `${candidato.voto}${candidato.club ? ` (${candidato.club})` : ''}`)
                  .join(' o ')}
                .
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </Card>
  )
}
