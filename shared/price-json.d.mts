export interface VoceJson {
  name: string
  rating: number
  price: number
}

export function leggiElencoJson(testo: string): {
  voci: VoceJson[]
  errore: string | null
  scartate: number
  duplicate: number
}
