import { useEffect, useState } from 'react'

import { getHealth, type HealthResponse } from './api.ts'

export interface HealthState {
  loading: boolean
  health: HealthResponse | null
  error: string | null
}

/** Stato della connessione al proxy dati, mostrato in alto in ogni pagina. */
export function useHealth(): HealthState {
  const [state, setState] = useState<HealthState>({ loading: true, health: null, error: null })

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    const check = () => {
      getHealth(controller.signal)
        .then((health) => {
          if (active) setState({ loading: false, health, error: null })
        })
        .catch((error: unknown) => {
          if (active) setState({ loading: false, health: null, error: error instanceof Error ? error.message : 'Errore' })
        })
    }

    check()
    const timer = setInterval(check, 60_000)
    return () => {
      active = false
      controller.abort()
      clearInterval(timer)
    }
  }, [])

  return state
}
