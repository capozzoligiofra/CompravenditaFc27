import assert from 'node:assert/strict'
import { test } from 'node:test'

import { isLiveSource, manualQuote, mergeQuotes } from '../shared/quotes.mjs'

const live = { price: 12_000, minPrice: 11_000, maxPrice: 13_000, changePercent: 2, updated: 'ora' }

test('il prezzo scritto a mano riempie i buchi della sorgente', () => {
  const merged = mergeQuotes({ '1': null }, { '1': { price: 9_000, at: Date.now() } }, 'futbin')
  assert.equal(merged['1'].price, 9_000)
  assert.equal(merged['1'].manual, true)
})

test('la quotazione vera vince su quella scritta a mano', () => {
  const merged = mergeQuotes({ '1': live }, { '1': { price: 9_000, at: Date.now() } }, 'futbin')
  assert.equal(merged['1'].price, 12_000)
  assert.equal(merged['1'].manual, undefined)
})

test('senza sorgente automatica comanda il prezzo scritto a mano', () => {
  const merged = mergeQuotes({ '1': { ...live, updated: 'vecchio' } }, { '1': { price: 9_000, at: Date.now() } }, 'locale')
  assert.equal(merged['1'].price, 9_000)
  assert.equal(merged['1'].manual, true)
})

test('un prezzo a zero non sovrascrive niente', () => {
  const merged = mergeQuotes({ '1': live }, { '1': { price: 0, at: Date.now() } }, 'locale')
  assert.equal(merged['1'].price, 12_000)
})

test('la data di inserimento finisce nella descrizione', () => {
  const quote = manualQuote(9_000, Date.parse('2026-09-18T10:00:00Z'))
  assert.match(quote.updated, /inserito da te il 18\/09\/2026/)
})

test('anche una sorgente diversa da Futbin conta come prezzo vero', () => {
  const merged = mergeQuotes({ '1': live }, { '1': { price: 9_000, at: Date.now() } }, 'api')
  assert.equal(merged['1'].price, 12_000)
  assert.equal(isLiveSource('api'), true)
  assert.equal(isLiveSource('locale'), false)
  // Risposte messe in cache da una versione precedente.
  assert.equal(isLiveSource('demo'), false)
})
