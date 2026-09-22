// L'archivio su file JSON: la riserva per quando SQLite non c'è. Stesse
// garanzie del database, meno possibilità.

import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'

import { creaArchivioJson } from '../server/archive-json.mjs'

let cartella
let percorso
let archivio

before(() => {
  cartella = mkdtempSync(join(tmpdir(), 'fc27-archivio-'))
  percorso = join(cartella, 'archivio.json')
  process.env.FUT_ARCHIVE_MAX = '3'
  archivio = creaArchivioJson(percorso)
})

after(() => rmSync(cartella, { recursive: true, force: true }))

const quote = (price) => ({ price, minPrice: price, maxPrice: price, changePercent: 0, updated: 'prova' })

test('registra una quotazione e la rilegge', () => {
  archivio.registraPrezzo('1', 'ps', quote(10_000))
  const letto = archivio.leggiPrezzo('1', 'ps')
  assert.equal(letto.price, 10_000)
  assert.match(letto.updated, /archivio/)
})

test('un prezzo scritto a mano si riconosce dal testo', () => {
  archivio.registraPrezzo('2', 'ps', quote(7_500), 'manuale')
  assert.match(archivio.leggiPrezzo('2', 'ps').updated, /scritto da te/)
})

test('ogni prezzo registrato alimenta lo storico', () => {
  archivio.registraPrezzo('3', 'ps', quote(5_000))
  assert.equal(archivio.leggiStorico('3', 'ps').length, 1)
  assert.equal(archivio.leggiStorico('3', 'xbox').length, 0)
})

test('i prezzi a zero non entrano', () => {
  archivio.registraPrezzo('4', 'ps', quote(0))
  assert.equal(archivio.leggiPrezzo('4', 'ps'), null)
})

test("l'elenco delle carte da seguire si salva senza duplicati", () => {
  assert.deepEqual(archivio.impostaInteresse(['5', '5', '6', '']), ['5', '6'])
  assert.deepEqual(archivio.leggiInteresse(), ['5', '6'])
})

test('senza database la domanda sui movimenti resta senza risposta', () => {
  assert.deepEqual(archivio.movimenti(), [])
})

test("l'archivio sopravvive a una ripartenza", () => {
  archivio.registraPrezzo('7', 'ps', quote(9_100))
  archivio.salvaOra()
  const riletto = creaArchivioJson(percorso)
  assert.equal(riletto.leggiPrezzo('7', 'ps').price, 9_100)
  assert.deepEqual(riletto.leggiInteresse(), ['5', '6'])
})
