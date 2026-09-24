import { useNavigate, useParams } from 'react-router-dom'

import PlayerSheet from '../components/PlayerSheet.tsx'

/** La pagina che ospita la scheda: un indirizzo per carta, condivisibile. */
export default function Player() {
  const { id = '' } = useParams()
  const naviga = useNavigate()

  return (
    <div className="space-y-3">
      {/* Si torna da dove si è arrivati: la scheda si apre dai prezzi, dalla
          watchlist, dalla rosa e dalle proposte. */}
      <button
        type="button"
        onClick={() => naviga(-1)}
        className="inline-block text-xs text-chalk-dim transition hover:text-chalk"
      >
        ← indietro
      </button>
      <PlayerSheet playerId={id} />
    </div>
  )
}
