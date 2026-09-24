import { useEffect, useState } from 'react'

import { useNavigate, useSearchParams } from 'react-router-dom'

import { Card, CardTitle, buttonClass, primaryButtonClass } from '../components/ui.tsx'
import { entra, normalizzaServer } from '../lib/cloud.ts'
import { useStore } from '../lib/useStore.ts'

/**
 * L'invito al listino: un link che porta già scritto l'indirizzo del server,
 * così chi lo riceve deve solo dire come si chiama invece di trascrivere un
 * indirizzo dal telefono — che è il punto in cui la gente si arrende.
 *
 * L'indirizzo arriva da un link, cioè da fuori: non ci si collega da soli.
 * Si mostra in chiaro dove si sta per entrare e si aspetta che sia la persona
 * a premere il pulsante.
 */
export default function Join() {
  const [parametri] = useSearchParams()
  const naviga = useNavigate()
  const { account, setAccount } = useStore()

  const proposto = normalizzaServer(parametri.get('listino') ?? '')
  const [nome, setNome] = useState(() => account?.nome ?? '')
  const [errore, setErrore] = useState<string | null>(null)
  const [collegando, setCollegando] = useState(false)

  // Un invito senza indirizzo non è un invito: si torna alle Opzioni, dove
  // l'indirizzo si può scrivere a mano.
  useEffect(() => {
    if (!proposto) naviga('/impostazioni', { replace: true })
  }, [proposto, naviga])

  if (!proposto) return null

  let host = proposto
  try {
    host = new URL(proposto).host
  } catch {
    host = proposto
  }

  const giaDentro = account?.server === proposto

  const collega = () => {
    const scelto = nome.trim()
    if (!scelto) {
      setErrore('Scrivi il nome con cui firmare i prezzi.')
      return
    }
    setCollegando(true)
    setErrore(null)
    entra(proposto, scelto)
      .then((nuovo) => {
        setAccount(nuovo)
        naviga('/prezzi')
      })
      .catch((problema: unknown) => setErrore(problema instanceof Error ? problema.message : 'Collegamento fallito.'))
      .finally(() => setCollegando(false))
  }

  return (
    <div className="space-y-4">
      <Card className="border-gain/30 bg-gain/5">
        <CardTitle hint="I prezzi del listino sono in comune: quelli che segni tu li vedono gli altri, e viceversa. La tua rosa resta tua.">
          Ti hanno invitato a un listino
        </CardTitle>

        <p className="text-sm text-chalk-dim">
          Stai per collegarti al listino di <strong className="text-chalk">{host}</strong>. Collegati solo se
          l'invito arriva da qualcuno che conosci: chi gestisce quell'indirizzo vede i prezzi che segni.
        </p>

        {giaDentro ? (
          <div className="mt-3 space-y-2">
            <p className="text-sm text-gain">Sei già dentro come {account?.nome}.</p>
            <button type="button" className={primaryButtonClass} onClick={() => naviga('/prezzi')}>
              Vai ai prezzi
            </button>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <label className="block">
              <span className="text-[11px] uppercase tracking-[0.14em] text-chalk-dim">Come ti chiami</span>
              <input
                value={nome}
                onChange={(event) => setNome(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') collega()
                }}
                placeholder="Il tuo nome"
                maxLength={40}
                autoFocus
                className="mt-1 w-full rounded-xl border border-pitch-line bg-pitch px-3 py-2 text-base outline-none focus:border-gain/60"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={primaryButtonClass} onClick={collega} disabled={collegando}>
                {collegando ? 'Entro…' : 'Entra nel listino'}
              </button>
              <button type="button" className={buttonClass} onClick={() => naviga('/')}>
                Non adesso
              </button>
            </div>
            {errore ? <p className="text-xs text-loss">{errore}</p> : null}
            <p className="text-[11px] text-chalk-dim">
              Il nome serve a firmare i prezzi e a ritrovare la tua rosa sugli altri dispositivi. Non è una password:
              chi conosce l'indirizzo può scrivere.
            </p>
          </div>
        )}
      </Card>
    </div>
  )
}
