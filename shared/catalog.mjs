// Il catalogo delle carte, quando non c'è nessuna sorgente automatica.
//
// Senza Futbin e senza API, l'elenco dei giocatori non lo regala nessuno: lo
// costruite voi. Chi non trova una carta la crea scrivendone nome e
// valutazione, e da quel momento esiste per tutti quelli collegati al listino.
//
// Il problema da risolvere è uno solo: se due persone creano «Lautaro
// Martínez 89» in due momenti diversi, devono ottenere **la stessa carta**,
// altrimenti il listino si riempie di doppioni e i prezzi si sparpagliano.
// Per questo l'identificativo non è casuale: si calcola dal nome e dalla
// valutazione, e chiunque parta dagli stessi due dati arriva allo stesso id.

import { normalizeName } from './text.mjs'

/** Il server accetta identificativi brevi: qui non si sfora mai. */
const MAX_ID = 32

function slug(valore) {
  return normalizeName(valore).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

/**
 * Un'impronta corta e stabile del nome completo: serve a non far collidere
 * due nomi diversi che, tagliati, diventerebbero uguali.
 */
function impronta(testo) {
  let h = 0x811c9dc5
  for (let i = 0; i < testo.length; i += 1) {
    h ^= testo.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(36).padStart(4, '0').slice(-4)
}

/**
 * L'identificativo di una carta creata a mano. Stesso nome e stessa
 * valutazione, stesso id — su qualunque dispositivo, in qualunque momento.
 */
export function idCarta(nome, valutazione = 0) {
  const pulito = slug(nome)
  if (!pulito) return ''
  const voto = Math.max(0, Math.min(99, Math.round(Number(valutazione) || 0)))
  return `c-${pulito.slice(0, 18)}-${voto}-${impronta(`${pulito}|${voto}`)}`.slice(0, MAX_ID)
}

/** Una carta creata a mano, pronta da mostrare e da mandare al listino. */
export function creaCarta({ name, rating = 0, position = '', club = '', league = '', nation = '', version = '' } = {}) {
  const nome = String(name ?? '').trim().replace(/\s+/g, ' ')
  const id = idCarta(nome, rating)
  if (!id) return null
  return {
    id,
    name: nome,
    rating: Math.max(0, Math.min(99, Math.round(Number(rating) || 0))),
    position,
    club,
    league,
    nation,
    version,
    image: '',
  }
}

/**
 * Cerca fra le carte che l'app conosce già: quelle che segui e quelle del
 * listino. Funziona senza rete, ed è la ricerca che resta quando non c'è
 * nessuna sorgente esterna.
 */
export function cercaCarte(testo, carte = [], limite = 12) {
  const cercato = normalizeName(testo)
  if (cercato.length < 2) return []
  const trovate = carte.filter((carta) => carta?.name && normalizeName(carta.name).includes(cercato))
  // Prima chi comincia con quello che hai scritto, poi i più forti: è
  // l'ordine in cui uno si aspetta di vedere i risultati.
  return trovate
    .sort((a, b) => {
      const aInizio = normalizeName(a.name).startsWith(cercato) ? 0 : 1
      const bInizio = normalizeName(b.name).startsWith(cercato) ? 0 : 1
      if (aInizio !== bInizio) return aInizio - bInizio
      return (b.rating || 0) - (a.rating || 0)
    })
    .slice(0, limite)
}

/** Tutte le carte che questo dispositivo conosce, senza doppioni. */
export function catalogoLocale({ seen = [], watchlist = [], positions = [], condivise = {} } = {}) {
  const mappa = new Map()
  const metti = (carta) => {
    if (!carta?.id || !carta.name) return
    const esistente = mappa.get(String(carta.id))
    if (!esistente || (carta.name.length > esistente.name.length)) mappa.set(String(carta.id), { ...esistente, ...carta })
  }
  for (const player of seen) metti(player)
  for (const item of watchlist) metti({ id: item.id, name: item.name, rating: item.rating, position: item.position, club: item.club })
  for (const posizione of positions) metti({ id: posizione.playerId, name: posizione.name, rating: posizione.rating })
  for (const [id, carta] of Object.entries(condivise)) metti({ id, name: carta?.name, rating: carta?.rating })
  return [...mappa.values()]
}
