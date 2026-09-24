// Il catalogo delle carte costruito a mano, senza sorgenti esterne.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  catalogoLocale,
  cercaCarte,
  creaCarta,
  dividiRigaCsv,
  idCarta,
  indicePerNome,
  leggiCsv,
  trovaNelCatalogo,
} from '../shared/catalog.mjs'

test('la stessa carta creata da due persone ha lo stesso identificativo', () => {
  assert.equal(idCarta('Lautaro Martínez', 89), idCarta('lautaro martinez', 89))
  assert.equal(idCarta('  Rafael   Leão  ', 86), idCarta('Rafael Leao', 86))
})

test('cambiando valutazione cambia carta: sono due carte diverse nel gioco', () => {
  assert.notEqual(idCarta('Lautaro Martínez', 89), idCarta('Lautaro Martínez', 91))
})

test('nomi diversi non collidono, nemmeno se lunghissimi e simili', () => {
  const uno = idCarta('Khvicha Kvaratskhelia Junior Primo', 87)
  const due = idCarta('Khvicha Kvaratskhelia Junior Secondo', 87)
  assert.notEqual(uno, due)
})

test("l'identificativo sta nei limiti che il server accetta", () => {
  for (const nome of ['A', 'Lautaro Martínez', 'Khvicha Kvaratskhelia', 'Un Nome Assurdamente Lungo Che Nessuno Userebbe Mai']) {
    const id = idCarta(nome, 88)
    assert.ok(id.length <= 32, `${id} è lungo ${id.length}`)
    assert.match(id, /^[A-Za-z0-9_-]{1,32}$/)
  }
})

test('senza un nome vero non si crea niente', () => {
  assert.equal(idCarta('   ', 88), '')
  assert.equal(creaCarta({ name: '', rating: 88 }), null)
  assert.equal(creaCarta({ name: '!!!', rating: 88 }), null)
})

test('la carta creata è pulita e con la valutazione nei limiti', () => {
  const carta = creaCarta({ name: '  Moise   Kean ', rating: '84', club: 'Fiorentina' })
  assert.equal(carta.name, 'Moise Kean')
  assert.equal(carta.rating, 84)
  assert.equal(carta.club, 'Fiorentina')
  assert.equal(carta.id, idCarta('Moise Kean', 84))
  assert.equal(creaCarta({ name: 'Tizio', rating: 300 }).rating, 99)
})

test('la ricerca trova senza accenti e mette davanti chi comincia così', () => {
  const carte = [
    { id: '1', name: 'Rafael Leão', rating: 86 },
    { id: '2', name: 'Leandro Paredes', rating: 82 },
    { id: '3', name: 'Lautaro Martínez', rating: 89 },
  ]
  assert.deepEqual(
    cercaCarte('lea', carte).map((carta) => carta.id),
    ['2', '1'],
  )
  assert.deepEqual(
    cercaCarte('MARTINEZ', carte).map((carta) => carta.id),
    ['3'],
  )
  assert.deepEqual(cercaCarte('l', carte), [])
})

test('il catalogo locale mette insieme rosa, watchlist, schede e listino senza doppioni', () => {
  const carte = catalogoLocale({
    seen: [{ id: '1', name: 'Lautaro Martínez', rating: 89, club: 'Inter' }],
    watchlist: [{ id: '2', name: 'Bastoni', rating: 85 }],
    positions: [{ playerId: '1', name: 'Lautaro', rating: 89 }],
    condivise: { 3: { name: 'Rafael Leão', rating: 86 } },
  })
  assert.equal(carte.length, 3)
  // Fra due versioni dello stesso nome resta la più completa.
  assert.equal(carte.find((carta) => carta.id === '1').name, 'Lautaro Martínez')
  assert.equal(carte.find((carta) => carta.id === '1').club, 'Inter')
})

test('legge un CSV con intestazione in inglese', () => {
  const csv = `name,rating,position,club
Lautaro Martínez,89,ST,Inter
Rafael Leão,86,LW,Milan`
  const esito = leggiCsv(csv)
  assert.equal(esito.errore, null)
  assert.equal(esito.carte.length, 2)
  assert.deepEqual(
    esito.carte.map((carta) => [carta.name, carta.rating, carta.club]),
    [
      ['Lautaro Martínez', 89, 'Inter'],
      ['Rafael Leão', 86, 'Milan'],
    ],
  )
})

test('legge un CSV con punto e virgola e intestazione in italiano', () => {
  const esito = leggiCsv('nome;valutazione\nMoise Kean;84\nAlessandro Bastoni;85')
  assert.equal(esito.carte.length, 2)
  assert.equal(esito.carte[0].rating, 84)
})

test('senza intestazione prende le prime due colonne', () => {
  const esito = leggiCsv('Moise Kean,84\nRafael Leao,86')
  assert.equal(esito.carte.length, 2)
  assert.equal(esito.carte[0].name, 'Moise Kean')
  assert.equal(esito.carte[0].rating, 84)
})

test('rispetta le virgolette e le virgole dentro i campi', () => {
  assert.deepEqual(dividiRigaCsv('"Martínez, Lautaro",89,"Inter"'), ['Martínez, Lautaro', '89', 'Inter'])
  assert.deepEqual(dividiRigaCsv('"dice ""ciao""",1'), ['dice "ciao"', '1'])
})

test('le righe senza nome si contano, i doppioni entrano una volta sola', () => {
  const esito = leggiCsv('name,rating\nKean,84\n,90\nKean,84\nX,70')
  // «X» è lungo un carattere: non è un nome.
  assert.equal(esito.carte.length, 1)
  assert.equal(esito.scartate, 2)
})

test('un file che non contiene nomi lo dice', () => {
  const esito = leggiCsv('1,2,3\n4,5,6')
  assert.ok(esito.errore)
})

test("l'indice trova per nome esatto, e sceglie la valutazione richiesta", () => {
  const carte = [
    { id: 'a', name: 'Moise Kean', rating: 84 },
    { id: 'b', name: 'Moise Kean', rating: 91 },
    { id: 'c', name: 'Rafael Leão', rating: 86 },
  ]
  const indice = indicePerNome(carte)
  assert.equal(trovaNelCatalogo('moise kean', 84, indice).id, 'a')
  // Senza valutazione vince la carta più forte.
  assert.equal(trovaNelCatalogo('MOISE  KEAN', 0, indice).id, 'b')
  // Gli accenti non contano.
  assert.equal(trovaNelCatalogo('rafael leao', 0, indice).id, 'c')
  // Una somiglianza non basta: meglio una carta nuova che un prezzo sbagliato.
  assert.equal(trovaNelCatalogo('Kean', 0, indice), null)
})

test("l'indice regge un catalogo grande senza rallentare", () => {
  const carte = Array.from({ length: 20_000 }, (_, i) => ({ id: `c${i}`, name: `Giocatore ${i}`, rating: 60 + (i % 40) }))
  const indice = indicePerNome(carte)
  const inizio = Date.now()
  for (let i = 0; i < 2_000; i += 1) trovaNelCatalogo(`Giocatore ${i * 7}`, 0, indice)
  assert.ok(Date.now() - inizio < 500, 'duemila ricerche su ventimila carte devono costare poco')
})

test('riconosce le colonne di un export vero: common_name e overall_rating', () => {
  // È il caso che aveva fatto importare ventimila righe di identificativi al
  // posto dei nomi: le colonne non si chiamavano «name» e «rating».
  const csv = `player_id,common_name,first_name,last_name,overall_rating,position,alternate_positions,club,league,nationality,gender
227203,Alexia Putellas,Alexia,Putellas Segura,91,CM,CAM ST,London City,Barclays WSL,Spain,Women's Football
231747,,Kylian,Mbappé,91,ST,LW,Real Madrid,LALIGA EA SPORTS,France,Men's Football`
  const esito = leggiCsv(csv)
  assert.equal(esito.errore, null)
  assert.equal(esito.colonne.nome, 'common_name')
  assert.equal(esito.colonne.valutazione, 'overall_rating')
  assert.equal(esito.carte.length, 2)

  const [putellas, mbappe] = esito.carte
  assert.equal(putellas.name, 'Alexia Putellas')
  assert.equal(putellas.rating, 91)
  assert.equal(putellas.club, 'London City')
  assert.equal(putellas.league, 'Barclays WSL')
  assert.equal(putellas.nation, 'Spain')
  assert.equal(putellas.alt, 'CAM ST')
  assert.equal(putellas.gender, "Women's Football")
  // Il nome comune può mancare: si compone da nome e cognome.
  assert.equal(mbappe.name, 'Kylian Mbappé')
})

test('i ruoli alternativi non rubano la colonna del ruolo', () => {
  const esito = leggiCsv('name,alternate_positions,position,rating\nTizio,CAM ST,CM,84')
  assert.equal(esito.carte[0].position, 'CM')
  assert.equal(esito.carte[0].alt, 'CAM ST')
})

test('le sei statistiche principali entrano nella carta, se ci sono', () => {
  const esito = leggiCsv('name,rating,pace,shooting,passing,dribbling,defending,physicality\nTizio,84,96,91,80,92,29,76')
  assert.deepEqual(esito.carte[0].stats, { pac: 96, sho: 91, pas: 80, dri: 92, dif: 29, fis: 76 })
})

test('una colonna in meno non manda tutto di traverso', () => {
  const esito = leggiCsv('common_name,overall_rating\nMoise Kean,84')
  assert.equal(esito.carte[0].name, 'Moise Kean')
  assert.equal(esito.carte[0].rating, 84)
  assert.equal(esito.carte[0].stats, undefined)
})
