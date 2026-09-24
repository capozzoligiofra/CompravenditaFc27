// Elenchi di prezzi incollati in JSON.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { leggiElencoJson } from '../shared/price-json.mjs'

test('legge anche un pezzo copiato a metà, senza parentesi quadre', () => {
  const testo = `{
    "nome": "Klara Bühl",
    "prezzo": "8.2K"
  },
  {
    "nome": "Alessia Russo",
    "prezzo": "14K"
  }`
  const esito = leggiElencoJson(testo)
  assert.equal(esito.errore, null)
  assert.deepEqual(esito.voci, [
    { name: 'Klara Bühl', rating: 0, price: 8_200 },
    { name: 'Alessia Russo', rating: 0, price: 14_000 },
  ])
})

test('perdona la virgola di troppo in fondo', () => {
  const esito = leggiElencoJson('[{"nome":"Kean","prezzo":"44K"},]')
  assert.equal(esito.errore, null)
  assert.equal(esito.voci.length, 1)
})

test('accetta le chiavi in inglese e i prezzi come numeri', () => {
  const esito = leggiElencoJson('[{"name":"Rafael Leão","price":58000,"rating":86}]')
  assert.deepEqual(esito.voci, [{ name: 'Rafael Leão', rating: 86, price: 58_000 }])
})

test("accetta l'elenco dentro una chiave, come lo darebbe un'API", () => {
  const esito = leggiElencoJson('{"giocatori":[{"nome":"Kean","prezzo":"1,2M"}]}')
  assert.deepEqual(esito.voci, [{ name: 'Kean', rating: 0, price: 1_200_000 }])
})

test('le righe senza nome o senza prezzo si contano invece di sparire', () => {
  const esito = leggiElencoJson('[{"nome":"Kean"},{"prezzo":"10K"},{"nome":"Leao","prezzo":"0"},{"nome":"Bastoni","prezzo":"44K"}]')
  assert.equal(esito.voci.length, 1)
  assert.equal(esito.scartate, 3)
})

test('lo stesso nome due volte entra una volta sola', () => {
  const esito = leggiElencoJson('[{"nome":"Moise Kean","prezzo":"44K"},{"nome":"moise  kean","prezzo":"45K"}]')
  assert.equal(esito.voci.length, 1)
  assert.equal(esito.duplicate, 1)
  assert.equal(esito.voci[0].price, 44_000)
})

test('lo stesso nome con valutazioni diverse sono due carte', () => {
  const esito = leggiElencoJson('[{"nome":"Kean","prezzo":"44K","rating":84},{"nome":"Kean","prezzo":"900K","rating":91}]')
  assert.equal(esito.voci.length, 2)
})

test('una carta sola, copiata da sé, è un elenco di uno', () => {
  const esito = leggiElencoJson('{"nome":"Klara Bühl","prezzo":"8.2K"}')
  assert.equal(esito.errore, null)
  assert.deepEqual(esito.voci, [{ name: 'Klara Bühl', rating: 0, price: 8_200 }])
})

test('un testo che non è JSON lo dice, invece di far finta di niente', () => {
  const esito = leggiElencoJson('<div class="player">Kean 44K</div>')
  assert.ok(esito.errore)
  assert.equal(esito.voci.length, 0)
})

test('il vuoto non è un errore', () => {
  assert.deepEqual(leggiElencoJson('   '), { voci: [], errore: null, scartate: 0, duplicate: 0 })
})
