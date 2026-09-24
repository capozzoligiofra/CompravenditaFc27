// Il catalogo delle carte costruito a mano, senza sorgenti esterne.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { catalogoLocale, cercaCarte, creaCarta, idCarta } from '../shared/catalog.mjs'

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
