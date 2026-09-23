import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'

import Layout from './components/Layout.tsx'
import { StoreProvider } from './lib/AppStore.tsx'
import Alerts from './pages/Alerts.tsx'
import Calculator from './pages/Calculator.tsx'
import Market from './pages/Market.tsx'
import Opportunities from './pages/Opportunities.tsx'
import Portfolio from './pages/Portfolio.tsx'
import Prices from './pages/Prices.tsx'
import SettingsPage from './pages/Settings.tsx'
import Watchlist from './pages/Watchlist.tsx'

export default function App() {
  return (
    <StoreProvider>
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </HashRouter>
    </StoreProvider>
  )
}
