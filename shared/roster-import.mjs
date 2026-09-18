// Importazione della rosa da testo incollato.
//
// Non esiste un modo consentito per leggere il club direttamente dall'account
// EA (vedi README), quindi la rosa si porta dentro incollandola. Il formato è
// volutamente permissivo: una riga per carta, con quantità e prezzo pagato
// facoltativi e scritti come capita.
//
//   Lautaro Martinez
//   Lautaro Martinez x2
//   Lautaro Martinez 150k
//   Lautaro Martinez, 2, 150000
//   Lautaro Martinez x2 @ 1.2M

import { normalizeName } from './text.mjs'

const MAX_RIGHE = 40

/**
 * Il punto è ambiguo: in "1.200.000" separa le migliaia, in "1.2M" è la
 * virgola decimale. Si decide dal contesto, altrimenti "1.2M" diventerebbe
 * dodici milioni.
 */
export function parseCoinsLoose(raw) {
  if (raw === null || raw === undefined) return 0
  let text = String(raw).trim().toLowerCase().replace(/\s/g, '')
  if (!text) return 0

  const suffisso = text.match(/([km])$/)?.[1] ?? ''
  if (suffisso) text = text.slice(0, -1)

  if (/^\d{1,3}(\.\d{3})+$/.test(text)) {
    text = text.replace(/\./g, '') // separatore delle migliaia all'italiana
  } else if (/^\d{1,3}(,\d{3})+$/.test(text)) {
    text = text.replace(/,/g, '') // separatore all'inglese
  } else {
    text = text.replace(',', '.')
  }

  const value = Number.parseFloat(text)
  if (!Number.isFinite(value)) return 0
  const factor = suffisso === 'm' ? 1_000_000 : suffisso === 'k' ? 1_000 : 1
  return Math.round(value * factor)
}

/** Una riga → nome, quantità, prezzo pagato. Le righe vuote si saltano. */
export function parseRosterLine(line) {
  const clean = String(line ?? '').trim()
  if (!clean || clean.startsWith('#')) return null

  const parts = clean.includes(',') ? clean.split(',').map((part) => part.trim()) : [clean]
  let name = parts[0]
  let quantity = 0
  let buyPrice = 0

  if (parts.length >= 2) {
    // Formato con virgole: nome, quantità, prezzo (il prezzo può mancare).
    const numeri = parts.slice(1).map(parseCoinsLoose).filter((value) => value > 0)
    if (numeri.length === 1) {
      if (numeri[0] <= 30) quantity = numeri[0]
      else buyPrice = numeri[0]
    } else if (numeri.length >= 2) {
      quantity = numeri[0] <= 30 ? numeri[0] : 1
      buyPrice = numeri[1]
    }
  }

  // Quantità scritta come "x2" o "2x", in qualunque punto della riga.
  const perQuantita = name.match(/(?:^|\s)x\s*(\d{1,2})(?:\s|$)|(?:^|\s)(\d{1,2})\s*x(?:\s|$)/i)
  if (perQuantita) {
    quantity = Number(perQuantita[1] ?? perQuantita[2]) || quantity
    name = name.replace(perQuantita[0], ' ')
  }

  // Prezzo in coda alla riga, con eventuale "@" o "a" davanti.
  const perPrezzo = name.match(/(?:@|\ba\b)?\s*([\d][\d.,]*\s*[km]?)\s*(?:crediti|cr)?\s*$/i)
  if (perPrezzo && !buyPrice) {
    const value = parseCoinsLoose(perPrezzo[1])
    // Un numero piccolo in coda è più probabile una quantità che un prezzo.
    if (value >= 150) {
      buyPrice = value
      name = name.slice(0, perPrezzo.index).trim()
    }
  }

  // Numero piccolo rimasto in coda: è la quantità, non un prezzo.
  const perQuantitaInCoda = name.match(/\s(\d{1,2})\s*$/)
  if (perQuantitaInCoda && !buyPrice) {
    const value = Number(perQuantitaInCoda[1])
    if (value >= 1 && value <= 30) {
      quantity = quantity > 1 ? quantity : value
      name = name.slice(0, perQuantitaInCoda.index).trim()
    }
  }

  name = name.replace(/[@,;]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (name.length < 2) return null

  return { name, quantity: quantity > 0 ? Math.min(30, quantity) : 1, buyPrice }
}

export function parseRoster(text) {
  return String(text ?? '')
    .split(/\r?\n/)
    .map(parseRosterLine)
    .filter(Boolean)
    .slice(0, MAX_RIGHE)
}

/**
 * Fra i risultati della ricerca sceglie la carta più probabile: prima la
 * corrispondenza esatta del nome, poi la valutazione più alta (di norma la
 * versione che si possiede davvero è quella più nota).
 */
export function pickBestMatch(name, players) {
  if (!Array.isArray(players) || players.length === 0) return null
  const target = normalizeName(name)
  const esatta = players.find((player) => normalizeName(player.name) === target)
  if (esatta) return esatta
  const contiene = players.filter((player) => normalizeName(player.name).includes(target))
  const pool = contiene.length > 0 ? contiene : players
  return [...pool].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))[0] ?? null
}

export const MAX_RIGHE_IMPORT = MAX_RIGHE
