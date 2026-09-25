// Abbinare i prezzi di una tabella alle carte dell'app.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { idCarta, indicePerNome } from '../shared/catalog.mjs'
import { abbinaSorgente } from '../shared/source.mjs'

const catalogo = [
  { id: idCarta('Aitana Bonmatí', 90), name: 'Aitana Bonmatí', rating: 90, aka: 'Aitana Bonmatí Conca|Bonmatí Conca' },
  { id: idCarta('Kylian Mbappé', 91), name: 'Kylian Mbappé', rating: 91 },
  { id: idCarta('Vitinha', 90), name: 'Vitinha', rating: 90 },
  { id: idCarta('Vitinha', 75), name: 'Vitinha', rating: 75 },
]
const indice = indicePerNome(catalogo)
const riga = (nome, price, voto = 0) => ({ nome, voto, price, at: 1_790_000_000_000 })

test('senza valutazione nella tabella, la mette il catalogo', () => {
  const { prezzi, carte } = abbinaSorgente([riga('Aitana Bonmatí', 1450000)], indice)
  const id = idCarta('Aitana Bonmatí', 90)
  assert.equal(prezzi[id]?.price, 1450000)
  assert.equal(carte[id]?.rating, 90, 'la carta esce con la valutazione del catalogo')
})

test('il nome scritto per esteso trova lo stesso la carta', () => {
  const { prezzi } = abbinaSorgente([riga('Aitana Bonmatí Conca', 1450000)], indice)
  assert.equal(prezzi[idCarta('Aitana Bonmatí', 90)]?.price, 1450000)
})

test('un nome che nel catalogo vale due giocatori non si assegna a caso', () => {
  const { prezzi, contesi } = abbinaSorgente([riga('Vitinha', 210000)], indice)
  assert.deepEqual(prezzi, {}, 'meglio nessun prezzo che il prezzo di un altro')
  assert.deepEqual(contesi, [{ nome: 'Vitinha', voti: [90, 75] }])
})

test('ma se la tabella la valutazione ce l’ha, i due Vitinha si distinguono', () => {
  const { prezzi, contesi } = abbinaSorgente([riga('Vitinha', 210000, 90), riga('Vitinha', 1500, 75)], indice)
  assert.deepEqual(contesi, [])
  assert.equal(prezzi[idCarta('Vitinha', 90)]?.price, 210000)
  assert.equal(prezzi[idCarta('Vitinha', 75)]?.price, 1500)
})

test('un nome che nel catalogo non c’è si mostra lo stesso', () => {
  const { prezzi, carte, sconosciuti } = abbinaSorgente([riga('Uno Mai Visto', 4200)], indice)
  const id = idCarta('Uno Mai Visto', 0)
  assert.equal(prezzi[id]?.price, 4200)
  assert.equal(carte[id]?.rating, 0)
  assert.deepEqual(sconosciuti, ['Uno Mai Visto'])
})

test('righe senza prezzo o senza nome si saltano', () => {
  const { prezzi } = abbinaSorgente([riga('Aitana Bonmatí', 0), riga('', 5000), riga('X', 5000)], indice)
  assert.deepEqual(prezzi, {})
})

test('la data della tabella arriva fino al prezzo', () => {
  const { prezzi } = abbinaSorgente([riga('Kylian Mbappé', 985000)], indice)
  assert.equal(prezzi[idCarta('Kylian Mbappé', 91)]?.at, 1_790_000_000_000)
})

test('senza catalogo si mostra comunque tutto, senza valutazione', () => {
  const { prezzi, carte } = abbinaSorgente([riga('Kylian Mbappé', 985000)], indicePerNome([]))
  const id = idCarta('Kylian Mbappé', 0)
  assert.equal(prezzi[id]?.price, 985000)
  assert.equal(carte[id]?.name, 'Kylian Mbappé')
})
