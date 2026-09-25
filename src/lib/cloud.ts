// Il client del listino condiviso: parla con il servizio PHP su Aruba.
//
// Tre principi, per non farne dipendere l'app:
//   - se il servizio non c'è o non risponde, l'app continua a funzionare con
//     quello che ha in locale: la condivisione è un di più, non un requisito;
//   - il nome non è una password e il token non protegge niente: servono a
//     firmare i prezzi e a ritrovare i propri dati, e lo diciamo apertamente;
//   - il tempo che conta per decidere chi ha ragione è quello
//     dell'osservazione, non quello della sincronizzazione.

import type { Unione } from '../../shared/duplicates.d.mts'
import type { AppData, Platform, Player } from '../types.ts'

const CHIAVE_ACCOUNT = 'fc27-trader:account'

export interface Account {
  /** L'indirizzo del servizio, per esempio https://tuosito.it/fc27/api.php */
  server: string
  nome: string
  token: string
}

export class CloudError extends Error {}

export function leggiAccount(): Account | null {
  try {
    const grezzo = localStorage.getItem(CHIAVE_ACCOUNT)
    if (!grezzo) return null
    const letto = JSON.parse(grezzo) as Partial<Account>
    if (!letto.server || !letto.nome || !letto.token) return null
    return { server: letto.server, nome: letto.nome, token: letto.token }
  } catch {
    return null
  }
}

export function salvaAccount(account: Account | null): void {
  try {
    if (account) localStorage.setItem(CHIAVE_ACCOUNT, JSON.stringify(account))
    else localStorage.removeItem(CHIAVE_ACCOUNT)
  } catch {
    // Storage bloccato: la condivisione varrà solo per questa sessione.
  }
}

/** L'indirizzo si scrive una volta; si accetta anche senza «api.php» in fondo. */
export function normalizzaServer(indirizzo: string): string {
  const pulito = indirizzo.trim().replace(/\s+/g, '')
  if (!pulito) return ''
  const conProtocollo = /^https?:\/\//i.test(pulito) ? pulito : `https://${pulito}`
  const senzaBarra = conProtocollo.replace(/\/+$/, '')
  return /api\.php$/i.test(senzaBarra) ? senzaBarra : `${senzaBarra}/api.php`
}

async function chiama<T>(
  server: string,
  azione: string,
  { metodo = 'GET', corpo, token, cerca, signal }: {
    metodo?: 'GET' | 'POST'
    corpo?: unknown
    token?: string
    cerca?: Record<string, string>
    signal?: AbortSignal
  } = {},
): Promise<T> {
  const url = new URL(server)
  url.searchParams.set('azione', azione)
  for (const [chiave, valore] of Object.entries(cerca ?? {})) url.searchParams.set(chiave, valore)

  let risposta: Response
  try {
    risposta = await fetch(url.toString(), {
      method: metodo,
      headers: {
        accept: 'application/json',
        ...(corpo ? { 'content-type': 'application/json' } : {}),
        ...(token ? { 'x-fc27-token': token } : {}),
      },
      body: corpo ? JSON.stringify(corpo) : undefined,
      signal,
    })
  } catch {
    throw new CloudError('Server del listino non raggiungibile.')
  }

  let dati: unknown = null
  try {
    dati = await risposta.json()
  } catch {
    // Una pagina HTML al posto del JSON vuol dire quasi sempre indirizzo
    // sbagliato: il messaggio lo dice, invece di parlare di JSON.
    throw new CloudError("A quell'indirizzo non risponde il listino: controlla il percorso di api.php.")
  }
  if (!risposta.ok) {
    const messaggio = (dati as { errore?: string } | null)?.errore
    throw new CloudError(messaggio ?? `Il server ha risposto ${risposta.status}.`)
  }
  return dati as T
}

export interface Salute {
  ok: boolean
  servizio: string
  versione: number
  adesso: number
  prezzi: number
  utenti: number
  puntiStorico: number
  ultimoAggiornamento: number
}

export function salute(server: string, signal?: AbortSignal): Promise<Salute> {
  return chiama<Salute>(server, 'salute', { signal })
}

export async function entra(server: string, nome: string): Promise<Account> {
  const risposta = await chiama<{ token: string; utente: { nome: string } }>(server, 'entra', {
    metodo: 'POST',
    corpo: { nome },
  })
  return { server, nome: risposta.utente.nome, token: risposta.token }
}

export interface PrezzoRemoto {
  id: string
  price: number
  at: number
  aggiornato: number
  autore: string
  carta: string
  valutazione: number
}

export function scaricaPrezzi(
  account: Account,
  piattaforma: Platform,
  da: number,
  signal?: AbortSignal,
): Promise<{ adesso: number; prezzi: PrezzoRemoto[] }> {
  return chiama(account.server, 'prezzi', {
    cerca: { piattaforma, da: String(da) },
    signal,
  })
}

export function inviaPrezzi(
  account: Account,
  piattaforma: Platform,
  prezzi: { id: string; price: number; at: number; giocatore?: Player | null }[],
): Promise<{ salvati: number; adesso: number }> {
  return chiama(account.server, 'prezzi', {
    metodo: 'POST',
    token: account.token,
    corpo: { piattaforma, prezzi },
  })
}

/** Il sottoinsieme dei dati che segue la persona, non il dispositivo. */
export type DatiPersonali = Pick<AppData, 'settings' | 'watchlist' | 'positions' | 'catalysts' | 'seen'>

/**
 * Cosa viaggia e cosa no. Viaggiano rosa, watchlist, catalizzatori, schede
 * viste e impostazioni: sono tuoi e li vuoi su tutti i dispositivi. Non
 * viaggiano gli avvisi (rumore di un dispositivo), i prezzi (quelli vanno nel
 * listino comune) e lo storico (se lo ricostruisce il server).
 */
export function datiPersonali(data: AppData): DatiPersonali {
  return {
    settings: data.settings,
    watchlist: data.watchlist,
    positions: data.positions,
    catalysts: data.catalysts,
    seen: data.seen,
  }
}

export function scaricaDati(
  account: Account,
  signal?: AbortSignal,
): Promise<{ contenuto: DatiPersonali | null; aggiornato: number }> {
  return chiama(account.server, 'dati', { token: account.token, signal })
}

export function inviaDati(
  account: Account,
  contenuto: DatiPersonali,
  aggiornato: number,
): Promise<{ aggiornato: number }> {
  return chiama(account.server, 'dati', {
    metodo: 'POST',
    token: account.token,
    corpo: { contenuto, aggiornato },
  })
}

/** Cerca nel catalogo comune: le carte che qualcuno del gruppo ha già creato. */
export function cercaNelListino(account: Account, testo: string, signal?: AbortSignal): Promise<{ giocatori: Player[] }> {
  return chiama(account.server, 'cerca', { cerca: { q: testo }, signal })
}

/** Rende trovabile agli altri una carta appena creata, anche senza prezzo. */
export function registraCarta(account: Account, giocatore: Player): Promise<{ id: string }> {
  return chiama(account.server, 'carta', { metodo: 'POST', token: account.token, corpo: { giocatore } })
}

/**
 * Dice al listino che due carte sono lo stesso giocatore. Il server sposta
 * prezzo e storico sulla carta buona e butta l'altra: senza questo passaggio
 * il doppione tornerebbe giù alla sincronizzazione dopo, qui e su tutti gli
 * altri dispositivi.
 */
export function unisciCarte(account: Account, unioni: Unione[]): Promise<{ unite: number }> {
  return chiama(account.server, 'unisci', {
    metodo: 'POST',
    token: account.token,
    corpo: { unioni: unioni.map(({ da, a }) => ({ da, a })) },
  })
}

export interface Diagnostica {
  php: string
  database: string
  giocatori: number
  tabelle: number
  mancanti: string[]
  pronto: boolean
  limiteCorpo: string
}

/** Cosa manca al servizio per funzionare: versioni e tabelle. */
export function diagnostica(server: string, signal?: AbortSignal): Promise<Diagnostica> {
  return chiama(server, 'diagnostica', { signal })
}

export interface StatoCatalogo {
  versione: number
  blocchi: number
  carte: number
  aggiornato: number
}

/** Che catalogo ha il gruppo, e quanto è nuovo. */
export function statoCatalogo(server: string, signal?: AbortSignal): Promise<StatoCatalogo> {
  return chiama(server, 'catalogo', { signal })
}

export function scaricaBloccoCatalogo(
  server: string,
  indice: number,
  signal?: AbortSignal,
): Promise<{ versione: number; indice: number; carte: unknown[] }> {
  return chiama(server, 'catalogo', { cerca: { blocco: String(indice) }, signal })
}

/**
 * Manda un blocco di catalogo. Il server lo pubblica solo quando sono
 * arrivati tutti: nessuno scarica un elenco a metà.
 */
export function inviaBloccoCatalogo(
  account: Account,
  blocco: { versione: number; indice: number; blocchi: number; totale: number; carte: unknown[] },
): Promise<{ completo: boolean }> {
  return chiama(account.server, 'catalogo', { metodo: 'POST', token: account.token, corpo: blocco })
}

export function chiCe(server: string, signal?: AbortSignal): Promise<{ persone: { nome: string; visto: number; prezzi: number }[] }> {
  return chiama(server, 'chi', { signal })
}
