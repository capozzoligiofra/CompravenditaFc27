import { useCallback, useMemo } from 'react'

import { catalogoLocale, creaCarta } from '../../shared/catalog.mjs'
import type { CartaBase } from '../../shared/catalog.d.mts'
import { matchKnownPlayer } from '../../shared/roster-import.mjs'
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
  const { data, importaPrezzi } = useStore()

  const catalogo = useMemo(
    () =>
      catalogoLocale({
        seen: data.seen,
        watchlist: data.watchlist,
        positions: data.positions,
        condivise: data.sharedPlayers,
      }) as CartaBase[],
    [data.seen, data.watchlist, data.positions, data.sharedPlayers],
  )

  /** Abbina ogni voce a una carta esistente, o ne prepara una nuova. */
  const prepara = useCallback(
    (voci: VoceDaImportare[]): RigaPreparata[] =>
      voci.map((voce) => {
        const nota = matchKnownPlayer(voce.name, catalogo) as CartaBase | null
        const player = (nota ?? creaCarta({ name: voce.name, rating: voce.rating ?? 0 })) as Player | null
        return { voce, player, nuova: !nota }
      }),
    [catalogo],
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
