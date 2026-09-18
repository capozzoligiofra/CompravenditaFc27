import assert from 'node:assert/strict'
import { test } from 'node:test'

import { parseRoster, parseRosterLine, pickBestMatch } from '../shared/roster-import.mjs'

test('legge il solo nome', () => {
  assert.deepEqual(parseRosterLine('Lautaro Martinez'), { name: 'Lautaro Martinez', quantity: 1, buyPrice: 0 })
})

test('legge la quantità scritta con la x', () => {
  assert.deepEqual(parseRosterLine('Lautaro Martinez x2'), { name: 'Lautaro Martinez', quantity: 2, buyPrice: 0 })
  assert.deepEqual(parseRosterLine('3x Theo Hernandez'), { name: 'Theo Hernandez', quantity: 3, buyPrice: 0 })
})

test('legge il prezzo pagato in forma abbreviata', () => {
  assert.deepEqual(parseRosterLine('Lautaro Martinez 150k'), { name: 'Lautaro Martinez', quantity: 1, buyPrice: 150_000 })
  assert.deepEqual(parseRosterLine('Mbappe @ 1.2M'), { name: 'Mbappe', quantity: 1, buyPrice: 1_200_000 })
})

test('legge il formato con le virgole', () => {
  assert.deepEqual(parseRosterLine('Rafael Leao, 2, 58000'), { name: 'Rafael Leao', quantity: 2, buyPrice: 58_000 })
})

test('quantità e prezzo insieme', () => {
  assert.deepEqual(parseRosterLine('Bastoni x3 44000'), { name: 'Bastoni', quantity: 3, buyPrice: 44_000 })
})

test('salta righe vuote e commenti', () => {
  const rosa = parseRoster('Lautaro\n\n# la mia rosa\nBarella x2\n')
  assert.deepEqual(rosa.map((riga) => riga.name), ['Lautaro', 'Barella'])
})

test('un numero piccolo in coda non diventa un prezzo', () => {
  assert.deepEqual(parseRosterLine('Kean 2'), { name: 'Kean', quantity: 2, buyPrice: 0 })
})

test('sceglie la corrispondenza esatta e non la valutazione più alta', () => {
  const trovati = [
    { name: 'Federico Dimarco', rating: 86 },
    { name: 'Dimarco', rating: 88 },
  ]
  assert.equal(pickBestMatch('Dimarco', trovati).rating, 88)
  assert.equal(pickBestMatch('Federico Dimarco', trovati).rating, 86)
})

test('senza corrispondenza esatta preferisce la valutazione più alta', () => {
  const trovati = [
    { name: 'Moise Kean', rating: 84 },
    { name: 'Moise Kean TOTW', rating: 87 },
  ]
  assert.equal(pickBestMatch('Kean', trovati).rating, 87)
})

test('il punto separa le migliaia quando non c\'è il suffisso', () => {
  assert.deepEqual(parseRosterLine('Barella 74.500'), { name: 'Barella', quantity: 1, buyPrice: 74_500 })
})

test('trova i giocatori anche scrivendo i nomi senza accenti', () => {
  const trovati = [{ name: 'Lautaro Martínez', rating: 88 }, { name: 'Rafael Leão', rating: 86 }]
  assert.equal(pickBestMatch('Lautaro Martinez', trovati).name, 'Lautaro Martínez')
  assert.equal(pickBestMatch('Leao', trovati).name, 'Rafael Leão')
})
