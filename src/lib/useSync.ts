import { useContext } from 'react'

import { SyncContext, type StatoSync } from './CloudSync.tsx'

const SPENTO: StatoSync = {
  attivo: false,
  inCorso: false,
  ultima: 0,
  errore: null,
  inAttesa: 0,
  sorgente: null,
  sincronizzaOra: () => {},
}

/** Lo stato del listino condiviso. Fuori dal provider risponde «spento». */
export function useSync(): StatoSync {
  return useContext(SyncContext) ?? SPENTO
}
