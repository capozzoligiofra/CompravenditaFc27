// L'archivio è il nostro database: un file JSON. Qui si verifica che ricordi,
// non cresca all'infinito e sopravviva a una ripartenza.

import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'

let cartella
let archivio

before(async () => {
  cartella = mkdtempSync(join(tmpdir(), 'fc27-archivio-'))
  process.env.FUT_ARCHIVE_FILE = join(cartella, 'archivio.json')
  process.env.FUT_ARCHIVE_MAX = '3'
  archivio = await import('../server/archive.mjs')
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

test("l'archivio non cresce oltre il limite e tiene le carte più recenti", () => {
  archivio.registraPrezzo('10', 'ps', quote(1_000))
  archivio.registraPrezzo('11', 'ps', quote(1_100))
  const conti = archivio.statistiche()
  assert.ok(conti.carte <= 3, `carte in archivio: ${conti.carte}`)
  assert.ok(archivio.leggiPrezzo('11', 'ps'), "l'ultima registrata deve restare")
})

test("l'elenco delle carte da seguire si salva senza duplicati", () => {
  const salvati = archivio.impostaInteresse(['5', '5', '6', ''])
  assert.deepEqual(salvati, ['5', '6'])
  assert.deepEqual(archivio.leggiInteresse(), ['5', '6'])
})

test("l'archivio sopravvive a una ripartenza", async () => {
  archivio.registraPrezzo('7', 'ps', quote(9_100))
  archivio.salvaOra()
  const riletto = await import(`../server/archive.mjs?riavvio=${Date.now()}`)
  assert.equal(riletto.leggiPrezzo('7', 'ps').price, 9_100)
  assert.deepEqual(riletto.leggiInteresse(), ['5', '6'])
})
