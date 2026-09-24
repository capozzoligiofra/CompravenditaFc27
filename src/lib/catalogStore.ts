import { idCarta } from '../../shared/catalog.mjs'
import type { CartaBase } from '../../shared/catalog.d.mts'

// Il catalogo sta per conto suo, non dentro i dati dell'app.
//
// Tre ragioni, tutte imparate a spese di una prova andata male. Può contenere
// ventimila carte, e i dati dell'app vengono riscritti a ogni modifica:
// infilarcelo dentro vorrebbe dire serializzare un megabyte ogni volta che
// segni un prezzo. Non è un dato personale, quindi non ha senso sincronizzarlo
// col listino. E soprattutto: lo spazio che un browser concede a un sito è
// di pochi megabyte in tutto — un catalogo scritto per esteso li esauriva e
// impediva all'app di salvare la rosa e i prezzi, in silenzio.
//
// Per questo si salva in forma compatta: niente identificativi (si ricalcolano
// dal nome e dalla valutazione, che è come nascono) e solo i campi che
// servono a riconoscere una carta.

const CHIAVE = 'fc27-trader:catalogo'

export type Catalogo = Record<string, CartaBase>

/** [nome, valutazione, ruolo, club] */
type RigaCompatta = [string, number, string?, string?]

interface Salvato {
  v: 1
  carte: RigaCompatta[]
}

function espandi(riga: RigaCompatta): CartaBase | null {
  const [name, rating, position = '', club = ''] = riga
  if (!name) return null
  const id = idCarta(name, rating)
  if (!id) return null
  return { id, name, rating: Number(rating) || 0, position, club, league: '', nation: '', version: '', image: '' }
}

export function leggiCatalogo(): Catalogo {
  try {
    const grezzo = localStorage.getItem(CHIAVE)
    if (!grezzo) return {}
    const letto = JSON.parse(grezzo) as Salvato
    if (!letto || !Array.isArray(letto.carte)) return {}
    const catalogo: Catalogo = {}
    for (const riga of letto.carte) {
      const carta = espandi(riga)
      if (carta) catalogo[carta.id] = carta
    }
    return catalogo
  } catch {
    return {}
  }
}

export function salvaCatalogo(catalogo: Catalogo): boolean {
  try {
    const carte: RigaCompatta[] = Object.values(catalogo).map((carta) =>
      carta.position || carta.club
        ? [carta.name, carta.rating, carta.position ?? '', carta.club ?? '']
        : [carta.name, carta.rating],
    )
    localStorage.setItem(CHIAVE, JSON.stringify({ v: 1, carte } satisfies Salvato))
    return true
  } catch {
    // Spazio del browser esaurito. Si toglie il catalogo invece di lasciarne
    // metà: meglio nessun catalogo che un'app che non riesce più a salvare i
    // tuoi prezzi.
    try {
      localStorage.removeItem(CHIAVE)
    } catch {
      // Niente da fare: lo dirà l'interfaccia.
    }
    return false
  }
}
