import assert from 'node:assert/strict'
import { test } from 'node:test'

import { MAX_PUNTI_STORICO, needsSnapshot, recordSnapshot } from '../shared/history.mjs'

const giorno = 86_400_000
const oggi = Date.parse('2026-09-18T12:00:00Z')

test('il primo prezzo diventa il primo punto', () => {
  const storico = recordSnapshot([], 10_000, oggi)
  assert.equal(storico.length, 1)
  assert.equal(storico[0].price, 10_000)
})

test('nello stesso giorno aggiorna invece di accumulare', () => {
  const primo = recordSnapshot([], 10_000, oggi)
  const secondo = recordSnapshot(primo, 11_000, oggi + 3_600_000)
  assert.equal(secondo.length, 1)
  assert.equal(secondo[0].price, 11_000)
})

test('un giorno nuovo aggiunge un punto', () => {
  const primo = recordSnapshot([], 10_000, oggi)
  const secondo = recordSnapshot(primo, 10_500, oggi + giorno)
  assert.equal(secondo.length, 2)
  assert.deepEqual(secondo.map((punto) => punto.price), [10_000, 10_500])
})

test('lo stesso prezzo nello stesso giorno non cambia nulla', () => {
  const primo = recordSnapshot([], 10_000, oggi)
  const secondo = recordSnapshot(primo, 10_000, oggi + 60_000)
  assert.equal(secondo, primo)
  assert.equal(needsSnapshot(primo, 10_000, oggi + 60_000), false)
  assert.equal(needsSnapshot(primo, 10_400, oggi + 60_000), true)
  assert.equal(needsSnapshot(primo, 10_000, oggi + giorno), true)
})

test('un prezzo a zero viene ignorato', () => {
  assert.deepEqual(recordSnapshot([], 0, oggi), [])
  assert.equal(needsSnapshot([], 0, oggi), false)
})

test('lo storico non cresce oltre il limite', () => {
  let storico = []
  for (let indice = 0; indice < MAX_PUNTI_STORICO + 20; indice += 1) {
    storico = recordSnapshot(storico, 10_000 + indice, oggi + indice * giorno)
  }
  assert.equal(storico.length, MAX_PUNTI_STORICO)
  assert.equal(storico.at(-1).price, 10_000 + MAX_PUNTI_STORICO + 19)
})
