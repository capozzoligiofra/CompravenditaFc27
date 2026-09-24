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

// --- Il catalogo da un file -------------------------------------------------
//
// Chi ha già un elenco di giocatori — un CSV esportato, un foglio, una lista
// tenuta a mano — non deve ribattere niente: lo carica e l'app lo usa come
// catalogo. Restano due cose separate, e conviene tenerle chiare:
//   il catalogo   tutte le carte che l'app sa nominare (anche 20.000)
//   le tue carte  quelle che segui davvero, poche e tue
// Il catalogo serve a cercare e a riconoscere i nomi; non riempie gli elenchi.

const DELIMITATORI = [',', ';', '\t', '|']

/** Il separatore più plausibile: quello che compare più volte nella prima riga. */
function scegliDelimitatore(prima) {
  let migliore = ','
  let massimo = 0
  for (const candidato of DELIMITATORI) {
    const quanti = prima.split(candidato).length - 1
    if (quanti > massimo) {
      massimo = quanti
      migliore = candidato
    }
  }
  return migliore
}

/** Divide una riga CSV rispettando le virgolette. */
export function dividiRigaCsv(riga, delimitatore = ',') {
  const campi = []
  let corrente = ''
  let dentroVirgolette = false
  for (let i = 0; i < riga.length; i += 1) {
    const carattere = riga[i]
    if (carattere === '"') {
      // Due virgolette di fila dentro un campo sono una virgoletta vera.
      if (dentroVirgolette && riga[i + 1] === '"') {
        corrente += '"'
        i += 1
      } else {
        dentroVirgolette = !dentroVirgolette
      }
    } else if (carattere === delimitatore && !dentroVirgolette) {
      campi.push(corrente)
      corrente = ''
    } else {
      corrente += carattere
    }
  }
  campi.push(corrente)
  return campi.map((campo) => campo.trim())
}

// Le intestazioni possibili, ridotte a sole lettere e numeri. Un file
// esportato può chiamare le colonne in mille modi — `name`, `common_name`,
// `overall_rating` — e sbagliare colonna significa importare ventimila righe
// di spazzatura senza accorgersene, come è successo la prima volta.
const COLONNE = {
  nome: ['commonname', 'name', 'nome', 'playername', 'fullname', 'giocatore', 'player'],
  primoNome: ['firstname', 'nome1', 'givenname'],
  cognome: ['lastname', 'surname', 'cognome', 'familyname'],
  valutazione: ['overallrating', 'overall', 'rating', 'ovr', 'valutazione', 'media'],
  ruolo: ['position', 'ruolo', 'pos', 'preferredposition', 'mainposition'],
  alternativi: ['alternatepositions', 'altpositions', 'otherpositions', 'ruolialternativi'],
  club: ['club', 'team', 'squadra', 'clubname'],
  lega: ['league', 'lega', 'campionato', 'leaguename'],
  nazione: ['nationality', 'nation', 'nazione', 'country', 'nazionalita'],
  genere: ['gender', 'genere'],
  versione: ['version', 'versione', 'cardtype', 'cardversion', 'rarity'],
  pac: ['pace', 'velocita'],
  sho: ['shooting', 'tiro'],
  pas: ['passing', 'passaggio', 'passaggi'],
  dri: ['dribbling'],
  dif: ['defending', 'difesa'],
  fis: ['physicality', 'physical', 'fisico'],
}

function intestazionePulita(voce) {
  return String(voce ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Trova la colonna giusta: prima per nome esatto, poi — solo se non c'è — per
 * contenuto. L'ordine conta: `alternate_positions` contiene `position`, e
 * senza la precedenza all'esatto i ruoli finirebbero nella colonna sbagliata.
 */
function trovaColonna(intestazioni, alias, occupate = new Set()) {
  for (const nome of alias) {
    const indice = intestazioni.findIndex((voce, i) => voce === nome && !occupate.has(i))
    if (indice >= 0) return indice
  }
  for (const nome of alias) {
    const indice = intestazioni.findIndex((voce, i) => voce.includes(nome) && !occupate.has(i))
    if (indice >= 0) return indice
  }
  return -1
}

/**
 * Legge un elenco di carte da un CSV. Si arrangia con quello che trova:
 * separatore virgola, punto e virgola o tabulazione, intestazioni in italiano
 * o in inglese, e — se l'intestazione non c'è — le prime due colonne intese
 * come nome e valutazione.
 *
 * @returns { carte, errore, scartate, colonne }
 */
export function leggiCsv(testo) {
  const righe = String(testo ?? '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((riga) => riga.trim().length > 0)
  if (righe.length === 0) return { carte: [], errore: null, scartate: 0, colonne: null }

  const delimitatore = scegliDelimitatore(righe[0])
  const intestazioni = dividiRigaCsv(righe[0], delimitatore).map(intestazionePulita)

  const occupate = new Set()
  const colonna = (chiave) => {
    const indice = trovaColonna(intestazioni, COLONNE[chiave], occupate)
    if (indice >= 0) occupate.add(indice)
    return indice
  }

  // L'ordine delle chiamate è l'ordine di precedenza: chi prende una colonna
  // la toglie agli altri.
  const cNome = colonna('nome')
  const cPrimoNome = colonna('primoNome')
  const cCognome = colonna('cognome')
  const cVoto = colonna('valutazione')
  const cRuolo = colonna('ruolo')
  const cAlternativi = colonna('alternativi')
  const cClub = colonna('club')
  const cLega = colonna('lega')
  const cNazione = colonna('nazione')
  const cGenere = colonna('genere')
  const cVersione = colonna('versione')
  const statistiche = { pac: colonna('pac'), sho: colonna('sho'), pas: colonna('pas'), dri: colonna('dri'), dif: colonna('dif'), fis: colonna('fis') }

  const conIntestazione = cNome >= 0 || cCognome >= 0 || cVoto >= 0
  const indiceNome = conIntestazione ? cNome : 0
  const indiceVoto = conIntestazione ? cVoto : 1

  const dati = conIntestazione ? righe.slice(1) : righe
  const carte = []
  const viste = new Set()
  let scartate = 0

  const campo = (campi, indice) => (indice >= 0 ? String(campi[indice] ?? '').trim() : '')
  const numero = (campi, indice) => {
    if (indice < 0) return 0
    const valore = Number.parseInt(String(campi[indice] ?? '').replace(/[^\d]/g, ''), 10)
    return Number.isFinite(valore) ? valore : 0
  }

  for (const riga of dati) {
    const campi = dividiRigaCsv(riga, delimitatore)
    // Il nome «comune» a volte manca (è vuoto per chi si conosce col nome
    // intero): in quel caso lo si compone da nome e cognome.
    let nome = campo(campi, indiceNome)
    if (!nome) nome = [campo(campi, cPrimoNome), campo(campi, cCognome)].filter(Boolean).join(' ')
    nome = nome.replace(/\s+/g, ' ').trim()

    if (nome.length < 2) {
      scartate += 1
      continue
    }

    const carta = creaCarta({
      name: nome,
      rating: numero(campi, indiceVoto),
      position: campo(campi, cRuolo),
      club: campo(campi, cClub),
      league: campo(campi, cLega),
      nation: campo(campi, cNazione),
      version: campo(campi, cVersione),
    })
    if (!carta) {
      scartate += 1
      continue
    }

    const alternativi = campo(campi, cAlternativi)
    if (alternativi) carta.alt = alternativi
    const genere = campo(campi, cGenere)
    if (genere) carta.gender = genere
    const valori = Object.fromEntries(
      Object.entries(statistiche)
        .map(([chiave, indice]) => [chiave, numero(campi, indice)])
        .filter(([, valore]) => valore > 0),
    )
    if (Object.keys(valori).length > 0) carta.stats = valori

    if (viste.has(carta.id)) continue
    viste.add(carta.id)
    carte.push(carta)
  }

  if (carte.length === 0) {
    return {
      carte: [],
      errore: "Non ho trovato nomi in questo file: serve almeno una colonna con il nome (e, se c'è, una con la valutazione).",
      scartate,
      colonne: null,
    }
  }

  const grezze = dividiRigaCsv(righe[0], delimitatore)
  return {
    carte,
    errore: null,
    scartate,
    colonne: {
      nome: conIntestazione ? (grezze[indiceNome] || [grezze[cPrimoNome], grezze[cCognome]].filter(Boolean).join(' + ')) : 'prima colonna',
      valutazione: indiceVoto >= 0 ? (grezze[indiceVoto] ?? null) : null,
      extra: [cRuolo, cClub, cLega, cNazione].filter((indice) => indice >= 0).map((indice) => grezze[indice]),
    },
  }
}

/**
 * Un indice per nome: con ventimila carte, cercarle scorrendo l'elenco a ogni
 * riga di un import significa milioni di confronti e un telefono che si pianta.
 */
export function indicePerNome(carte = []) {
  const indice = new Map()
  for (const carta of carte) {
    if (!carta?.name) continue
    const chiave = normalizeName(carta.name)
    const elenco = indice.get(chiave)
    if (elenco) elenco.push(carta)
    else indice.set(chiave, [carta])
  }
  return indice
}

/**
 * La carta che corrisponde a questo nome, se c'è.
 *
 * Solo corrispondenza esatta del nome (senza accenti e maiuscole): con un
 * catalogo grande, accontentarsi di una somiglianza vuol dire assegnare il
 * prezzo di Vinícius a «Vini Jr» e non accorgersene mai. Fra più carte con lo
 * stesso nome vince quella con la valutazione richiesta, altrimenti la più alta.
 */
export function trovaNelCatalogo(nome, valutazione, indice) {
  const chiave = normalizeName(nome)
  if (chiave.length < 2) return null
  const candidate = indice?.get(chiave)
  if (!candidate || candidate.length === 0) return null
  if (valutazione > 0) {
    const esatta = candidate.find((carta) => carta.rating === valutazione)
    if (esatta) return esatta
  }
  return [...candidate].sort((a, b) => (b.rating || 0) - (a.rating || 0))[0]
}
