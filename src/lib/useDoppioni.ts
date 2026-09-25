import { useMemo } from 'react'

import { catalogoLocale } from '../../shared/catalog.mjs'
import type { CartaBase } from '../../shared/catalog.d.mts'
import { trovaDoppioni } from '../../shared/duplicates.mjs'
import type { Ambiguo, Unione } from '../../shared/duplicates.d.mts'
import { useStore } from './useStore.ts'

/**
 * I doppioni che l'app vede adesso: le carte senza valutazione che hanno un
 * gemello nel catalogo.
 *
 * Si guarda tutto quello che l'app conosce — catalogo, carte viste, watchlist,
 * rosa e listino — perché il segnaposto può stare in un posto e la carta buona
 * in un altro: il prezzo incollato mesi fa vive fra le carte viste, il gemello
 * con il voto è arrivato dopo con il catalogo.
 */
export function useDoppioni(): { unioni: Unione[]; ambigui: Ambiguo[] } {
  const { data, catalogo } = useStore()
  return useMemo(() => {
    const carte = catalogoLocale({
      seen: data.seen,
      watchlist: data.watchlist,
      positions: data.positions,
      condivise: data.sharedPlayers,
    }) as CartaBase[]
    return trovaDoppioni([...Object.values(catalogo), ...carte])
  }, [data.seen, data.watchlist, data.positions, data.sharedPlayers, catalogo])
}
