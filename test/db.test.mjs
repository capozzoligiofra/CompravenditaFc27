// Il database vero: stesse garanzie dell'archivio su file, più le domande
// che solo un database sa reggere.

import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, test } from 'node:test'

import { creaArchivioSqlite, sqliteDisponibile } from '../server/db.mjs'

const GIORNO = 86_400_000
let cartella
let archivio

before(() => {
  cartella = mkdtempSync(join(tmpdir(), 'fc27-db-'))
  archivio = creaArchivioSqlite(join(cartella, 'prova.sqlite'))
})

after(() => {
  archivio?.chiudi()
  rmSync(cartella, { recursive: true, force: true })
})

const quote = (price) => ({ price, minPrice: price, maxPrice: price, changePercent: 0, updated: 'prova' })

test('node:sqlite è disponibile su questa versione di Node', () => {
  assert.equal(sqliteDisponibile(), true)
})

test('registra e rilegge una quotazione', () => {
  archivio.ricordaGiocatore({ id: '1', name: 'Tizio', rating: 86, league: 'Serie A', nation: 'Italia' })
  archivio.registraPrezzo('1', 'ps', quote(10_000))
  assert.equal(archivio.leggiPrezzo('1', 'ps').price, 10_000)
  assert.equal(archivio.leggiGiocatore('1').name, 'Tizio')
})

test('un prezzo scritto a mano resta riconoscibile', () => {
  archivio.registraPrezzo('2', 'ps', quote(7_500), 'manuale')
  assert.match(archivio.leggiPrezzo('2', 'ps').updated, /scritto da te/)
})

test('due registrazioni nello stesso giorno non duplicano lo storico', () => {
  archivio.registraPrezzo('3', 'ps', quote(5_000))
  archivio.registraPrezzo('3', 'ps', quote(5_400))
  const storico = archivio.leggiStorico('3', 'ps')
  assert.equal(storico.length, 1)
  assert.equal(storico[0].price, 5_400)
})

test('i prezzi a zero non entrano', () => {
  archivio.registraPrezzo('4', 'ps', quote(0))
  assert.equal(archivio.leggiPrezzo('4', 'ps'), null)
})

test('trova le carte scese di più negli ultimi giorni', () => {
  const adesso = Date.now()
  // Una carta crollata e una salita, registrate tre giorni fa e oggi.
  archivio.ricordaGiocatore({ id: '20', name: 'Calante', rating: 84 })
  archivio.registraPrezzo('20', 'ps', quote(20_000), 'sorgente', adesso - 3 * GIORNO)
  archivio.registraPrezzo('20', 'ps', quote(14_000), 'sorgente', adesso)

  archivio.ricordaGiocatore({ id: '21', name: 'Crescente', rating: 85 })
  archivio.registraPrezzo('21', 'ps', quote(10_000), 'sorgente', adesso - 3 * GIORNO)
  archivio.registraPrezzo('21', 'ps', quote(13_000), 'sorgente', adesso)

  const cali = archivio.movimenti({ piattaforma: 'ps', giorni: 3, limite: 5 })
  const calante = cali.find((riga) => riga.id === '20')
  assert.ok(calante, 'la carta in calo deve comparire')
  assert.equal(calante.nome, 'Calante')
  assert.equal(calante.variazione, -30)
  // Il primo della lista è il calo più forte.
  assert.equal(cali[0].id, '20')

  const rialzi = archivio.movimenti({ piattaforma: 'ps', giorni: 3, limite: 5, verso: 'rialzo' })
  assert.equal(rialzi[0].id, '21')
  assert.equal(rialzi[0].variazione, 30)
})

test("l'elenco delle carte da seguire non ha duplicati e si rilegge", () => {
  assert.deepEqual(archivio.impostaInteresse(['7', '7', '8', '']), ['7', '8'])
  assert.deepEqual(archivio.leggiInteresse(), ['7', '8'])
})

test('le statistiche dichiarano il motore', () => {
  const conti = archivio.statistiche()
  assert.equal(conti.motore, 'sqlite')
  assert.ok(conti.carte >= 3)
})

test('il database sopravvive alla chiusura e riapertura', () => {
  archivio.registraPrezzo('30', 'ps', quote(3_300))
  archivio.chiudi()
  archivio = creaArchivioSqlite(join(cartella, 'prova.sqlite'))
  assert.equal(archivio.leggiPrezzo('30', 'ps').price, 3_300)
})
