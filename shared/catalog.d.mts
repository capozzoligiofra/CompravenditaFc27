export interface CartaBase {
  id: string
  name: string
  rating: number
  position?: string
  club?: string
  league?: string
  nation?: string
  version?: string
  image?: string
  /** Ruoli alternativi, come li scrive il gioco: «CAM ST». */
  alt?: string
  /** Calcio maschile o femminile, quando il file lo dice. */
  gender?: string
  /** Le sei statistiche principali, se il file le contiene. */
  stats?: Record<string, number>
}

export function idCarta(nome: string, valutazione?: number): string
export function creaCarta(dati: {
  name: string
  rating?: number
  position?: string
  club?: string
  league?: string
  nation?: string
  version?: string
}): CartaBase | null
export function cercaCarte<T extends { name: string; rating?: number }>(testo: string, carte?: T[], limite?: number): T[]
export function catalogoLocale(input?: {
  seen?: CartaBase[]
  watchlist?: { id: string; name: string; rating: number; position?: string; club?: string }[]
  positions?: { playerId: string; name: string; rating: number }[]
  condivise?: Record<string, { name: string; rating: number }>
}): CartaBase[]

export function dividiRigaCsv(riga: string, delimitatore?: string): string[]
export function leggiCsv(testo: string): {
  carte: CartaBase[]
  errore: string | null
  scartate: number
  colonne: { nome: string; valutazione: string | null; extra?: string[] } | null
}
export function indicePerNome(carte?: CartaBase[]): Map<string, CartaBase[]>
export function trovaNelCatalogo(
  nome: string,
  valutazione: number,
  indice: Map<string, CartaBase[]>,
): CartaBase | null
