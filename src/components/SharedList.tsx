import { useEffect, useState } from 'react'

import { chiCe, entra, normalizzaServer, salute, type Salute } from '../lib/cloud.ts'
import { useStore } from '../lib/useStore.ts'
import { useSync } from '../lib/useSync.ts'
import { Card, CardTitle, Pill, buttonClass, primaryButtonClass } from './ui.tsx'

function quandoBreve(istante: number): string {
  if (!istante) return 'mai'
  const minuti = Math.round((Date.now() - istante) / 60_000)
  if (minuti < 1) return 'adesso'
  if (minuti < 60) return `${minuti} min fa`
  const ore = Math.round(minuti / 60)
  if (ore < 24) return `${ore} ${ore === 1 ? 'ora' : 'ore'} fa`
  const giorni = Math.round(ore / 24)
  return `${giorni} ${giorni === 1 ? 'giorno' : 'giorni'} fa`
}

/**
 * Il listino in comune: i prezzi che scrivi li vedono anche gli altri, e
 * viceversa. Il nome serve a firmarli e a ritrovare la tua rosa sugli altri
 * dispositivi — non è una password, e l'app lo dice invece di far finta.
 */
export default function SharedList() {
  const { account, setAccount, data } = useStore()
  const sync = useSync()
  const [indirizzo, setIndirizzo] = useState(() => account?.server ?? '')
  const [nome, setNome] = useState(() => account?.nome ?? '')
  const [errore, setErrore] = useState<string | null>(null)
  const [collegando, setCollegando] = useState(false)
  const [stato, setStato] = useState<Salute | null>(null)
  const [persone, setPersone] = useState<{ nome: string; visto: number; prezzi: number }[]>([])

  // Con il listino collegato si mostra come sta: quante carte ha e chi lo usa.
  useEffect(() => {
    if (!account) return undefined
    const controller = new AbortController()
    salute(account.server, controller.signal)
      .then(setStato)
      .catch(() => setStato(null))
    chiCe(account.server, controller.signal)
      .then((risposta) => setPersone(risposta.persone))
      .catch(() => setPersone([]))
    return () => controller.abort()
  }, [account, sync.ultima])

  const collega = () => {
    const server = normalizzaServer(indirizzo)
    const scelto = nome.trim()
    if (!server || !scelto) {
      setErrore("Servono l'indirizzo del listino e il nome con cui firmare i prezzi.")
      return
    }
    setCollegando(true)
    setErrore(null)
    entra(server, scelto)
      .then((nuovo) => {
        setAccount(nuovo)
        setIndirizzo(nuovo.server)
        setNome(nuovo.nome)
      })
      .catch((problema: unknown) => setErrore(problema instanceof Error ? problema.message : 'Collegamento fallito.'))
      .finally(() => setCollegando(false))
  }

  const carteInComune = Object.keys(data.sharedPrices).length

  return (
    <Card>
      <CardTitle hint="I prezzi sono in comune: quello che segni tu lo vedono gli altri, e quello che segnano loro lo vedi tu. Rosa e watchlist restano tue, ma ti seguono su ogni dispositivo.">
        Listino condiviso
      </CardTitle>

      {account ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={sync.errore ? 'loss' : 'gain'}>{sync.errore ? 'non sincronizzato' : 'collegato'}</Pill>
            <span className="text-sm">
              come <strong>{account.nome}</strong>
            </span>
            <span className="truncate text-xs text-chalk-dim">{account.server}</span>
          </div>

          <p className="text-xs text-chalk-dim">
            {carteInComune} carte nel listino di questo dispositivo
            {stato ? ` · ${stato.prezzi} sul server · ${stato.utenti} persone` : ''} · ultima sincronizzazione{' '}
            {sync.inCorso ? 'in corso…' : quandoBreve(sync.ultima)}
            {sync.inAttesa > 0 ? ` · ${sync.inAttesa} tuoi prezzi ancora da mandare` : ''}
          </p>

          {sync.errore ? <p className="text-xs text-loss">{sync.errore}</p> : null}

          {persone.length > 0 ? (
            <p className="text-xs text-chalk-dim">
              Chi scrive i prezzi:{' '}
              {persone
                .slice(0, 6)
                .map((persona) => `${persona.nome} (${persona.prezzi})`)
                .join(', ')}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button type="button" className={buttonClass} onClick={sync.sincronizzaOra} disabled={sync.inCorso}>
              {sync.inCorso ? 'Sincronizzo…' : 'Sincronizza ora'}
            </button>
            <button
              type="button"
              className={buttonClass}
              onClick={() => {
                // Si esce dal listino, non si cancella niente: i prezzi già
                // scaricati restano, e la rosa è sempre qui.
                setAccount(null)
                setStato(null)
                setPersone([])
              }}
            >
              Esci dal listino
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.14em] text-chalk-dim">Indirizzo del listino</span>
            <input
              value={indirizzo}
              onChange={(event) => setIndirizzo(event.target.value)}
              placeholder="https://iltuosito.it/fc27/api.php"
              className="mt-1 w-full rounded-xl border border-pitch-line bg-pitch px-3 py-2 font-mono text-sm outline-none focus:border-gain/60"
            />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-[0.14em] text-chalk-dim">Il tuo nome</span>
            <input
              value={nome}
              onChange={(event) => setNome(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') collega()
              }}
              placeholder="Giofra"
              maxLength={40}
              className="mt-1 w-full rounded-xl border border-pitch-line bg-pitch px-3 py-2 text-sm outline-none focus:border-gain/60"
            />
          </label>
          <button type="button" className={primaryButtonClass} onClick={collega} disabled={collegando}>
            {collegando ? 'Collego…' : 'Collegati al listino'}
          </button>
          {errore ? <p className="text-xs text-loss">{errore}</p> : null}
          <p className="text-[11px] text-chalk-dim">
            Il nome non è una password: chi conosce l'indirizzo può scrivere prezzi, e scrivendo il tuo nome scriverebbe
            a nome tuo. Va bene fra persone che si conoscono — è la scelta che abbiamo fatto per tenerlo semplice.
            Istruzioni per metterlo online: cartella <code className="font-mono">server-php/</code> del progetto.
          </p>
        </div>
      )}
    </Card>
  )
}
