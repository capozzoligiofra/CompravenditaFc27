import { idCarta } from '../../shared/catalog.mjs'
import type { CartaBase } from '../../shared/catalog.d.mts'

// Il catalogo sta per conto suo, non dentro i dati dell'app.
//
// Tre ragioni, tutte imparate a spese di una prova andata male. Può contenere
// ventimila carte, e i dati dell'app vengono riscritti a ogni modifica:
// infilarcelo dentro vorrebbe dire serializzare megabyte ogni volta che segni
// un prezzo. Non è un dato personale, quindi non si sincronizza come tale. E
// soprattutto: lo spazio che un browser concede a un sito è di pochi megabyte
// in tutto — un catalogo scritto per esteso li esauriva e impediva all'app di
// salvare la rosa e i prezzi, in silenzio.
//
// Perciò si salva in forma compatta e, se non ci sta, si scende di dettaglio
// invece di fallire: prima si rinuncia alle statistiche, poi a campionato e
// nazione. Meglio un catalogo essenziale che nessun catalogo — e in ogni caso
// mai a costo dei tuoi dati.

const CHIAVE = 'fc27-trader:catalogo'
const CHIAVE_VERSIONE = 'fc27-trader:catalogo-versione'

export type Catalogo = Record<string, CartaBase>

/** [nome, voto, ruolo, club, lega, nazione, alternativi, genere, [statistiche]] */
export type RigaCompatta = [string, number, string?, string?, string?, string?, string?, string?, number[]?]

interface Salvato {
  v: 1
  carte: RigaCompatta[]
}

const CHIAVI_STATISTICHE = ['pac', 'sho', 'pas', 'dri', 'dif', 'fis'] as const

export function compattaCarta(carta: CartaBase, dettaglio: 'completo' | 'ridotto' | 'minimo' = 'completo'): RigaCompatta {
  if (dettaglio === 'minimo') return [carta.name, carta.rating]
  if (dettaglio === 'ridotto') return [carta.name, carta.rating, carta.position ?? '', carta.club ?? '']
  const stats = carta.stats ? CHIAVI_STATISTICHE.map((chiave) => carta.stats?.[chiave] ?? 0) : undefined
  return [
    carta.name,
    carta.rating,
    carta.position ?? '',
    carta.club ?? '',
    carta.league ?? '',
    carta.nation ?? '',
    carta.alt ?? '',
    carta.gender ?? '',
    stats,
  ]
}

export function espandiCarta(riga: RigaCompatta): CartaBase | null {
  const [name, rating, position = '', club = '', league = '', nation = '', alt = '', gender = '', stats] = riga
  if (!name) return null
  const id = idCarta(name, rating)
  if (!id) return null
  const carta: CartaBase = {
    id,
    name,
    rating: Number(rating) || 0,
    position,
    club,
    league,
    nation,
    version: '',
    image: '',
  }
  if (alt) carta.alt = alt
  if (gender) carta.gender = gender
  if (Array.isArray(stats) && stats.some((valore) => valore > 0)) {
    carta.stats = Object.fromEntries(CHIAVI_STATISTICHE.map((chiave, indice) => [chiave, stats[indice] ?? 0]))
  }
  return carta
}

export function leggiCatalogo(): Catalogo {
  try {
    const grezzo = localStorage.getItem(CHIAVE)
    if (!grezzo) return {}
    const letto = JSON.parse(grezzo) as Salvato
    if (!letto || !Array.isArray(letto.carte)) return {}
    const catalogo: Catalogo = {}
    for (const riga of letto.carte) {
      const carta = espandiCarta(riga)
      if (carta) catalogo[carta.id] = carta
    }
    return catalogo
  } catch {
    return {}
  }
}

export interface EsitoSalvataggio {
  salvato: boolean
  /** Quanto dettaglio è stato possibile tenere. */
  dettaglio: 'completo' | 'ridotto' | 'minimo' | 'nessuno'
}

export function salvaCatalogo(catalogo: Catalogo): EsitoSalvataggio {
  const carte = Object.values(catalogo)
  for (const dettaglio of ['completo', 'ridotto', 'minimo'] as const) {
    try {
      localStorage.setItem(CHIAVE, JSON.stringify({ v: 1, carte: carte.map((carta) => compattaCarta(carta, dettaglio)) }))
      return { salvato: true, dettaglio }
    } catch {
      // Si riprova con meno dettaglio.
    }
  }
  // Non ci sta nemmeno l'essenziale: si toglie del tutto, perché un catalogo
  // a metà che occupa tutto lo spazio è il peggiore dei mondi.
  try {
    localStorage.removeItem(CHIAVE)
  } catch {
    // Lo dirà l'interfaccia.
  }
  return { salvato: false, dettaglio: 'nessuno' }
}

/**
 * La stessa riga, ma con l'identificativo davanti: è la forma in cui il
 * catalogo viaggia verso il server. In memoria l'id si omette (si ricalcola
 * da nome e valutazione) perché sono trenta caratteri per ventimila carte;
 * al server invece serve, perché è la chiave della tabella dei giocatori.
 */
export type RigaTrasporto = [string, ...RigaCompatta]

export function perIlServer(carta: CartaBase): RigaTrasporto {
  return [carta.id, ...compattaCarta(carta)]
}

export function dalServer(riga: unknown): CartaBase | null {
  if (!Array.isArray(riga) || riga.length === 0) return null
  // Si accetta anche il formato senza id, per non rompere i cataloghi
  // caricati prima di questa versione.
  const conId = typeof riga[0] === 'string' && typeof riga[1] === 'string'
  const carta = espandiCarta((conId ? riga.slice(1) : riga) as RigaCompatta)
  if (!carta) return null
  return conId ? { ...carta, id: String(riga[0]) } : carta
}

/** La versione del catalogo condiviso che questo dispositivo ha già scaricato. */
export function leggiVersioneCatalogo(): number {
  try {
    return Number(localStorage.getItem(CHIAVE_VERSIONE)) || 0
  } catch {
    return 0
  }
}

export function salvaVersioneCatalogo(versione: number): void {
  try {
    localStorage.setItem(CHIAVE_VERSIONE, String(versione))
  } catch {
    // Pazienza: al prossimo avvio lo riscaricherà.
  }
}
