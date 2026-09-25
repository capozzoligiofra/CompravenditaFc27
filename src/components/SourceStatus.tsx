import { useEffect, useState } from 'react'

import { Card, CardTitle } from './ui.tsx'
import { statoSorgente, type StatoSorgente, type TabellaSorgente } from '../lib/cloud.ts'
import { useStore } from '../lib/useStore.ts'

const RUOLI: Record<string, string> = {
  nome: 'nome',
  valutazione: 'valutazione',
  prezzo: 'prezzo',
  aggiornato: 'data',
  giorno: 'giorno',
  piattaforma: 'piattaforma',
}

function elencoColonne(tabella: TabellaSorgente) {
  const usate = Object.entries(tabella.riconosciute).filter(([, colonna]) => colonna)
  if (usate.length === 0) return null
  return usate.map(([ruolo, colonna]) => `${RUOLI[ruolo] ?? ruolo} → «${colonna}»`).join(', ')
}

/**
 * La sorgente automatica: le tabelle dei prezzi messe nel database.
 *
 * Questo pannello esiste per una ragione sola, ed è dirti **cosa ha capito
 * delle tue colonne**. I nomi delle colonne non si indovinano — ogni database
 * ha i suoi — e una sorgente che non si aggancia fallisce in silenzio: prezzi
 * che non arrivano, senza nessun errore da nessuna parte. Qui invece si legge
 * nero su bianco quale colonna il server sta usando per il prezzo, quale per
 * il nome, e quali non ha riconosciuto.
 *
 * Chi non ha una sorgente non vede niente: è un di più, non un requisito.
 */
export default function SourceStatus() {
  const { account } = useStore()
  const [stato, setStato] = useState<StatoSorgente | null>(null)

  useEffect(() => {
    if (!account) {
      setStato(null)
      return undefined
    }
    const taglia = new AbortController()
    statoSorgente(account.server, taglia.signal)
      .then(setStato)
      .catch(() => setStato(null))
    return () => taglia.abort()
  }, [account])

  // Niente sorgente, niente pannello: non si occupa spazio per dire che una
  // cosa che non hai non c'è.
  if (!stato || !stato.attiva || !stato.prezzi.esiste) return null

  const colonne = elencoColonne(stato.prezzi)
  const colonneStorico = elencoColonne(stato.storico)

  return (
    <Card>
      <CardTitle hint="Le tabelle dei prezzi che hai nel database. L'app le legge da sola a ogni sincronizzazione, e non ci scrive mai dentro.">
        Sorgente automatica
      </CardTitle>

      {stato.pronta ? (
        <p className="text-sm text-gain">
          {stato.prezzi.righe.toLocaleString('it-IT')} righe in «{stato.prezzi.tabella}», lette a ogni
          sincronizzazione.
        </p>
      ) : (
        <p className="text-sm text-loss">
          Trovo la tabella «{stato.prezzi.tabella}» ma non riconosco {stato.prezzi.mancanti.length === 1 ? 'la colonna' : 'le colonne'}{' '}
          {stato.prezzi.mancanti.map((ruolo) => RUOLI[ruolo] ?? ruolo).join(' e ')}. Le sue colonne sono:{' '}
          {stato.prezzi.colonne.map((colonna) => `«${colonna}»`).join(', ')}. Scrivi quelle giuste in{' '}
          <code className="font-mono">config.php</code>, sotto{' '}
          <code className="font-mono">sorgente_colonne_prezzi</code>.
        </p>
      )}

      {colonne ? <p className="mt-2 text-xs text-chalk-dim">Prezzi: {colonne}.</p> : null}

      {stato.storico.esiste ? (
        stato.storico.pronto ? (
          <p className="mt-1 text-xs text-chalk-dim">
            Andamento: {stato.storico.righe.toLocaleString('it-IT')} righe in «{stato.storico.tabella}»
            {colonneStorico ? ` (${colonneStorico})` : ''}.
          </p>
        ) : (
          <p className="mt-1 text-xs text-loss">
            In «{stato.storico.tabella}» non riconosco {stato.storico.mancanti.map((r) => RUOLI[r] ?? r).join(' e ')}:
            le colonne sono {stato.storico.colonne.map((c) => `«${c}»`).join(', ')}.
          </p>
        )
      ) : (
        <p className="mt-1 text-xs text-chalk-dim">
          Nessuna tabella «{stato.storico.tabella}»: i prezzi ci sono, l'andamento passato no.
        </p>
      )}

      <p className="mt-3 text-[11px] text-chalk-dim">
        I prezzi della sorgente valgono come tutti gli altri: vince l'osservazione più recente. Quelli che hai
        scritto tu non si perdono — restano al loro posto e tornano a valere appena sono i più freschi.
      </p>
    </Card>
  )
}
