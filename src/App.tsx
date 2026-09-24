import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'

import Layout from './components/Layout.tsx'
import { StoreProvider } from './lib/AppStore.tsx'
import { SyncProvider } from './lib/CloudSync.tsx'
import Alerts from './pages/Alerts.tsx'
import Calculator from './pages/Calculator.tsx'
import Join from './pages/Join.tsx'
import Market from './pages/Market.tsx'
import Opportunities from './pages/Opportunities.tsx'
import Portfolio from './pages/Portfolio.tsx'
import Prices from './pages/Prices.tsx'
import SettingsPage from './pages/Settings.tsx'
import Watchlist from './pages/Watchlist.tsx'

export default function App() {
  return (
    <StoreProvider>
      {/* La sincronizzazione sta sopra le pagine: il listino condiviso vale
          per tutta l'app, non per una schermata. */}
      <SyncProvider>
        <HashRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Opportunities />} />
              <Route path="/prezzi" element={<Prices />} />
              <Route path="/mercato" element={<Market />} />
              <Route path="/avvisi" element={<Alerts />} />
              <Route path="/watchlist" element={<Watchlist />} />
              <Route path="/calcolatore" element={<Calculator />} />
              <Route path="/portafoglio" element={<Portfolio />} />
              <Route path="/impostazioni" element={<SettingsPage />} />
              {/* L'invito: un link che porta già l'indirizzo del listino. */}
              <Route path="/entra" element={<Join />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </HashRouter>
      </SyncProvider>
    </StoreProvider>
  )
}
