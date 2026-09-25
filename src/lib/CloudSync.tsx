import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import { applicaRemoti, daInviare, scegliDati } from '../../shared/sync.mjs'
import { catalogoLocale } from '../../shared/catalog.mjs'
import type { CartaBase } from '../../shared/catalog.d.mts'
import type { PrezzoCondiviso } from '../../shared/sync.d.mts'
import { dalServer, leggiVersioneCatalogo, salvaVersioneCatalogo } from './catalogStore.ts'
import {
  CloudError,
  datiPersonali,
  entra,
  inviaDati,
  prezziSorgente,
  inviaPrezzi,
  scaricaBloccoCatalogo,
  scaricaDati,
  scaricaPrezzi,
  statoCatalogo,
  type DatiPersonali,
} from './cloud.ts'
import { useStore } from './useStore.ts'

const OGNI = 3 * 60_000
/** Non si rientra più spesso di così: se il server dice sempre di no, non serve insistere. */
const UN_MINUTO = 60_000
/** Quante carte si chiedono alla sorgente per volta: quelle che segui, non tutta la tabella. */
const MAX_CARTE_SORGENTE = 2000
const ATTESA_DOPO_UNA_MODIFICA = 2_000

export interface StatoSync {
  /** Collegato a un listino condiviso. */
  attivo: boolean
  inCorso: boolean
  /** Ultima sincronizzazione riuscita, orologio di questo dispositivo. */
  ultima: number
  errore: string | null
  /** Quanti dei tuoi prezzi il server non ha ancora. */
  inAttesa: number
  sincronizzaOra: () => void
}

export const SyncContext = createContext<StatoSync | null>(null)

/**
 * Tiene allineato il listino: scarica quello che gli altri hanno segnato,
 * manda quello che hai segnato tu, e fa lo stesso con i tuoi dati personali.
 *
 * Gira in sottofondo e non blocca mai l'app: se il server non risponde, si
 * continua con quello che c'è in locale e il prossimo giro riproverà. È la
 * ragione per cui l'app funziona anche in metropolitana.
 */
function raccogliCarte(prezzi: { id: string; carta?: string; valutazione?: number }[]) {
  const carte: Record<string, { name: string; rating: number }> = {}
  for (const voce of prezzi) {
    if (voce?.id && voce.carta) carte[voce.id] = { name: voce.carta, rating: Number(voce.valutazione) || 0 }
  }
  return carte
}

export function SyncProvider({ children }: { children: ReactNode }) {
  const store = useStore()
  const { account, setAccount, impostaPrezziCondivisi, impostaPrezziSorgente, applicaDatiRemoti, segnaDatiCambiati, aggiungiAlCatalogo } = store

  // Il ciclo di sincronizzazione è asincrono: quando finisce, lo stato di
  // React può essere cambiato sotto i piedi. Si lavora sempre sull'ultima
  // versione dei dati, non su quella catturata alla partenza.
  const datiRef = useRef(store.data)
  useEffect(() => {
    datiRef.current = store.data
  })

  const [inCorso, setInCorso] = useState(false)
  const [ultima, setUltima] = useState(0)
  const [errore, setErrore] = useState<string | null>(null)
  const occupato = useRef(false)
  const rientrato = useRef(0)
  // null = non si sa ancora, false = il server non ha una sorgente utilizzabile.
  const sorgenteViva = useRef<boolean | null>(null)
  const impronta = useRef<string | null>(null)

  const allineaCatalogo = useCallback(async () => {
    if (!account) return
    const stato = await statoCatalogo(account.server)
    if (!stato?.versione || stato.versione <= leggiVersioneCatalogo()) return
    const carte = []
    for (let indice = 0; indice < stato.blocchi; indice += 1) {
      const blocco = await scaricaBloccoCatalogo(account.server, indice)
      for (const riga of blocco.carte) {
        const carta = dalServer(riga)
        if (carta) carte.push(carta)
      }
    }
    if (carte.length === 0) return
    const esito = aggiungiAlCatalogo(carte)
    // La versione si annota solo se il catalogo è entrato davvero: se il
    // browser era pieno, al prossimo giro ci riproviamo.
    if (esito.salvato) salvaVersioneCatalogo(stato.versione)
  }, [account, aggiungiAlCatalogo])

  /**
   * I prezzi della sorgente automatica, per le carte che l'app conosce.
   *
   * Si chiede solo quello che serve: le carte che segui, non le ventimila
   * della tabella. E se il server non ha una sorgente non succede niente —
   * e' un di piu', non un requisito, e l'app deve funzionare identica senza.
   */
  const leggiSorgente = useCallback(async () => {
    if (!account) return
    if (sorgenteViva.current === false) return
    const dati = datiRef.current
    const carte = (
      catalogoLocale({
        seen: dati.seen,
        watchlist: dati.watchlist,
        positions: dati.positions,
        condivise: dati.sharedPlayers,
      }) as CartaBase[]
    )
      .slice(0, MAX_CARTE_SORGENTE)
      .map((carta) => ({ id: carta.id, nome: carta.name, voto: carta.rating }))

    if (carte.length === 0) return
    try {
      const esito = await prezziSorgente(account.server, dati.settings.platform, carte)
      sorgenteViva.current = true
      impostaPrezziSorgente(Object.fromEntries(esito.prezzi.map((voce) => [voce.id, { price: voce.price, at: voce.at }])))
    } catch (problema) {
      // Un 409 vuol dire «non ho una sorgente, o non la capisco»: e' una
      // risposta, non un guasto, e non si insiste a ogni sincronizzazione.
      if (problema instanceof CloudError && problema.stato === 409) sorgenteViva.current = false
      else throw problema
    }
  }, [account, impostaPrezziSorgente])

  const sincronizza = useCallback(async () => {
    if (!account || occupato.current) return
    occupato.current = true
    setInCorso(true)
    try {
      const dati = datiRef.current
      const piattaforma = dati.settings.platform
      // Il listino è per piattaforma: cambiandola si riparte da zero, invece
      // di mostrare prezzi PlayStation a chi gioca su Xbox.
      const stessaPiattaforma = dati.syncedPlatform === piattaforma
      const partenza = stessaPiattaforma ? (dati.sharedPrices as Record<string, PrezzoCondiviso>) : {}
      const cursorePartenza = stessaPiattaforma ? dati.syncedAt : 0

      const giu = await scaricaPrezzi(account, piattaforma, cursorePartenza)
      let condivisi = applicaRemoti(partenza, giu.prezzi).condivisi as Record<string, PrezzoCondiviso>
      let cursore = giu.adesso
      // Con i prezzi arrivano i nomi delle carte: senza, chi entra in un
      // listino già avviato si troverebbe cifre senza sapere di chi sono.
      const carte = raccogliCarte(giu.prezzi)

      const daMandare = daInviare(dati.manualPrices, condivisi)
      if (daMandare.length > 0) {
        await inviaPrezzi(
          account,
          piattaforma,
          daMandare.map((voce) => ({
            ...voce,
            // Con il prezzo viaggia la carta, così sul server il listino ha
            // dei nomi e non solo dei numeri.
            giocatore: dati.seen.find((player) => player.id === voce.id) ?? null,
          })),
        )
        const ritorno = await scaricaPrezzi(account, piattaforma, cursore)
        condivisi = applicaRemoti(condivisi, ritorno.prezzi).condivisi as Record<string, PrezzoCondiviso>
        cursore = ritorno.adesso
        Object.assign(carte, raccogliCarte(ritorno.prezzi))
      }
      impostaPrezziCondivisi(condivisi, cursore, piattaforma, carte)

      const mio = datiPersonali(datiRef.current)
      const remoto = await scaricaDati(account)
      const scelta = scegliDati({
        locale: mio,
        localeAggiornatoAl: datiRef.current.dataChangedAt,
        remoto: remoto.contenuto,
        remotoAggiornatoAl: remoto.aggiornato,
      })
      if (scelta === 'applica' && remoto.contenuto) {
        applicaDatiRemoti(remoto.contenuto, remoto.aggiornato)
        // Si aggiorna subito l'impronta: quello che arriva dal server non è
        // una tua modifica, e non va rispedito indietro.
        impronta.current = JSON.stringify(remoto.contenuto)
      } else if (scelta === 'invia') {
        const quando = datiRef.current.dataChangedAt || Date.now()
        await inviaDati(account, mio, quando)
        segnaDatiCambiati(quando)
        impronta.current = JSON.stringify(mio)
      }

      // Il catalogo del gruppo: si scarica solo se è più nuovo di quello che
      // hai già, e una volta sola — sono megabyte, non un ping.
      await allineaCatalogo()
      await leggiSorgente()

      setErrore(null)
      setUltima(Date.now())
    } catch (problema) {
      // Il token non vale più: il listino è stato svuotato dal pannello, o
      // le sessioni sono scadute. Non è una cosa da far risolvere a mano —
      // il token non è una password, è il nome che dice chi sei, e quello
      // l'app ce l'ha. Si rientra da soli e si riprova.
      if (problema instanceof CloudError && problema.stato === 401 && Date.now() - rientrato.current > UN_MINUTO) {
        rientrato.current = Date.now()
        try {
          setAccount(await entra(account.server, account.nome))
          setErrore(null)
          return
        } catch {
          // Se non si riesce nemmeno a rientrare, vale il messaggio di sotto.
        }
      }
      setErrore(problema instanceof Error ? problema.message : 'Sincronizzazione non riuscita.')
    } finally {
      occupato.current = false
      setInCorso(false)
    }
  }, [account, setAccount, impostaPrezziCondivisi, applicaDatiRemoti, segnaDatiCambiati, allineaCatalogo, leggiSorgente])

  // Appena collegati, poi ogni tanto, e ogni volta che si torna sull'app:
  // è il momento in cui è più probabile che qualcun altro abbia scritto.
  // Anche al cambio di piattaforma, perché il listino è un altro.
  const piattaforma = store.settings.platform
  useEffect(() => {
    if (!account) return undefined
    void piattaforma
    void sincronizza()
    const timer = setInterval(() => void sincronizza(), OGNI)
    const alRitorno = () => {
      if (document.visibilityState === 'visible') void sincronizza()
    }
    document.addEventListener('visibilitychange', alRitorno)
    window.addEventListener('online', alRitorno)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', alRitorno)
      window.removeEventListener('online', alRitorno)
    }
  }, [account, piattaforma, sincronizza])

  // Un prezzo appena scritto non deve aspettare tre minuti per arrivare agli
  // altri: si parte poco dopo, quel tanto che basta per non spedire una
  // richiesta per ogni tasto premuto.
  const prezziLocali = store.data.manualPrices
  useEffect(() => {
    if (!account || Object.keys(prezziLocali).length === 0) return undefined
    const timer = setTimeout(() => void sincronizza(), ATTESA_DOPO_UNA_MODIFICA)
    return () => clearTimeout(timer)
  }, [account, prezziLocali, sincronizza])

  // I dati personali non hanno una data di modifica loro: la si ricava
  // accorgendosi che il contenuto è cambiato.
  const personali = datiPersonali(store.data)
  const serializzati = JSON.stringify(personali)
  useEffect(() => {
    if (impronta.current === null) {
      impronta.current = serializzati
      return
    }
    if (impronta.current === serializzati) return
    impronta.current = serializzati
    segnaDatiCambiati(Date.now())
  }, [serializzati, segnaDatiCambiati])

  const inAttesa = useMemo(
    () => daInviare(store.data.manualPrices, store.data.sharedPrices as Record<string, PrezzoCondiviso>).length,
    [store.data.manualPrices, store.data.sharedPrices],
  )

  const valore = useMemo<StatoSync>(
    () => ({
      attivo: Boolean(account),
      inCorso,
      ultima,
      errore,
      inAttesa,
      sincronizzaOra: () => void sincronizza(),
    }),
    [account, inCorso, ultima, errore, inAttesa, sincronizza],
  )

  return <SyncContext.Provider value={valore}>{children}</SyncContext.Provider>
}

export type { DatiPersonali }
