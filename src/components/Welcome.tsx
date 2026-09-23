import { useState } from 'react'

import { Link } from 'react-router-dom'

import { Card, buttonClass, primaryButtonClass } from './ui.tsx'

const CHIAVE = 'fc27-trader:benvenuto'

function giaVisto(): boolean {
  try {
    return localStorage.getItem(CHIAVE) === 'fatto'
  } catch {
    return false
  }
}

function ricorda(): void {
  try {
    localStorage.setItem(CHIAVE, 'fatto')
  } catch {
    // Storage bloccato: al massimo il benvenuto ricompare. Non è un problema.
  }
}

/**
 * Le tre cose da sapere aprendo l'app per la prima volta, per chi ci arriva
 * da un link e non sa cos'ha davanti. Sparisce da sola appena ci sono dati.
 */
export default function Welcome({ vuota }: { vuota: boolean }) {
  const [chiuso, setChiuso] = useState(() => giaVisto())
  if (chiuso || !vuota) return null

  const chiudi = () => {
    ricorda()
    setChiuso(true)
  }

  return (
    <Card className="border-gain/30 bg-gain/5">
      <h2 className="text-base font-semibold">Benvenuto: cos'è questa app</h2>
      <ul className="mt-2 space-y-2 text-sm text-chalk-dim">
        <li>
          <strong className="text-chalk">Fa i conti al posto tuo.</strong> Tassa del 5%, margine reale, prezzo massimo
          a cui comprare, momento della settimana in cui il mercato sale o scende.
        </li>
        <li>
          <strong className="text-chalk">I prezzi li metti tu.</strong> Futbin non consente le richieste automatiche,
          quindi qui i prezzi sono d'esempio finché non scrivi quelli che vedi in gioco: si fa in un minuto dalla
          pagina <Link to="/prezzi" className="text-gain underline">Prezzi</Link>, e da lì nascono storico, stime e
          proposte.
        </li>
        <li>
          <strong className="text-chalk">I tuoi dati restano tuoi.</strong> Rosa, watchlist e prezzi vivono in questo
          browser: niente account, niente server, nessuno li vede. Cambiando telefono si portano via con il backup in
          Opzioni.
        </li>
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link to="/prezzi" className={primaryButtonClass} onClick={chiudi}>
          Inizia dai prezzi
        </Link>
        <button type="button" className={buttonClass} onClick={chiudi}>
          Ho capito
        </button>
      </div>
      <p className="mt-2 text-[11px] text-chalk-dim">
        Suggerimento: dal menu del browser, «Installa app» o «Aggiungi a Home», così sta fra le altre app e funziona
        anche senza rete.
      </p>
    </Card>
  )
}
