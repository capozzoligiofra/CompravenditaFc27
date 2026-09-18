import { useContext } from 'react'

import { StoreContext, type Store } from './AppStore.tsx'

export function useStore(): Store {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useStore va usato dentro <StoreProvider>')
  return store
}
