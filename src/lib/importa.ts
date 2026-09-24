import { useCallback, useMemo } from 'react'

import { catalogoLocale, creaCarta, indicePerNome, trovaNelCatalogo } from '../../shared/catalog.mjs'
import type { CartaBase } from '../../shared/catalog.d.mts'
import { useStore } from './useStore.ts'
import type { Player } from '../types.ts'

export interface VoceDaImportare {
  name: string
  price: number
  rating?: number
}

export interface RigaPreparata {
  voce: VoceDaImportare
  player: Player | null
  /** La carta non esisteva: verrà creata adesso. */
  nuova: boolean
}

/**
 * Applicare un elenco di prezzi, da qualunque forma arrivi (righe di testo o
 * JSON), con la stessa regola: se la carta c'è si aggiorna, se non c'è si
 * crea.
 *
 * Prima la creazione era solo nell'import JSON e l'elenco a righe rispondeva
 * «non trovati»: due comportamenti diversi per lo stesso gesto. E dato che il
 * catalogo lo costruite voi — nessuna sorgente ci regala l'elenco dei
 * giocatori — rifiutare un nome sconosciuto significherebbe rifiutare quasi
 * tutto all'inizio.
 */
export function useApplicaPrezzi() {
  const { data, catalogo, importaPrezzi } = useStore()

  // L'indice si costruisce una volta sola: con un catalogo da ventimila
  // carte, cercare scorrendo l'elenco a ogni riga vuol dire milioni di
  // confronti e un telefono che si pianta a metà import.
  const indice = useMemo(() => {
    const carte = catalogoLocale({
      seen: data.seen,
      watchlist: data.watchlist,
      positions: data.positions,
      condivise: data.sharedPlayers,
    }) as CartaBase[]
    return indicePerNome([...Object.values(catalogo), ...carte])
  }, [data.seen, data.watchlist, data.positions, data.sharedPlayers, catalogo])

  /** Abbina ogni voce a una carta esistente, o ne prepara una nuova. */
  const prepara = useCallback(
    (voci: VoceDaImportare[]): RigaPreparata[] =>
      voci.map((voce) => {
        const nota = trovaNelCatalogo(voce.name, voce.rating ?? 0, indice) as CartaBase | null
        const player = (nota ?? creaCarta({ name: voce.name, rating: voce.rating ?? 0 })) as Player | null
        return { voce, player, nuova: !nota }
      }),
    [indice],
  )

  const applica = useCallback(
    (righe: RigaPreparata[]) => {
      const valide = righe.filter((riga) => riga.player)
      importaPrezzi(valide.map((riga) => ({ player: riga.player as Player, price: riga.voce.price })))
      return { aggiornate: valide.length, create: valide.filter((riga) => riga.nuova).length }
    },
    [importaPrezzi],
  )

  return { prepara, applica }
}

/** Il resoconto in italiano, uguale per tutte le forme di import. */
export function riassuntoImport(esito: { aggiornate: number; create: number }): string {
  const prezzi = esito.aggiornate === 1 ? '1 prezzo aggiornato' : `${esito.aggiornate} prezzi aggiornati`
  if (esito.create === 0) return `${prezzi}.`
  const carte = esito.create === 1 ? '1 carta nuova' : `${esito.create} carte nuove`
  return `${prezzi}, di cui ${carte} create adesso.`
}
