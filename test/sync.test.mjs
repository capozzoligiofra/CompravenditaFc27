// Il listino condiviso e la regola per decidere chi ha ragione.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { applicaRemoti, daInviare, localiSuperati, prezziEffettivi, scegliDati } from '../shared/sync.mjs'

const ADESSO = Date.parse('2026-09-23T10:00:00Z')
const ORA = 3_600_000

test('senza niente in comune valgono i prezzi scritti da te', () => {
  const locali = { 1: { price: 10_000, at: ADESSO } }
  assert.deepEqual(prezziEffettivi(locali, {}), { 1: { price: 10_000, at: ADESSO } })
})

test('il prezzo comune più recente batte il tuo più vecchio', () => {
  const effettivi = prezziEffettivi(
    { 1: { price: 10_000, at: ADESSO - 5 * ORA } },
    { 1: { price: 12_000, at: ADESSO, autore: 'Marco' } },
  )
  assert.equal(effettivi[1].price, 12_000)
  assert.equal(effettivi[1].autore, 'Marco')
})

test('il prezzo che hai appena scritto batte quello comune di ieri', () => {
  const effettivi = prezziEffettivi(
    { 1: { price: 9_000, at: ADESSO } },
    { 1: { price: 12_000, at: ADESSO - 24 * ORA, autore: 'Marco' } },
  )
  assert.equal(effettivi[1].price, 9_000)
})

test('si spedisce solo ciò che il server non ha già, e prima il più vecchio', () => {
  const locali = {
    nuovo: { price: 5_000, at: ADESSO - ORA },
    piuFresco: { price: 7_000, at: ADESSO },
    giaNoto: { price: 3_000, at: ADESSO - 10 * ORA },
  }
  const condivisi = {
    piuFresco: { price: 6_000, at: ADESSO - 2 * ORA },
    giaNoto: { price: 3_000, at: ADESSO - 10 * ORA },
  }
  assert.deepEqual(
    daInviare(locali, condivisi).map((voce) => voce.id),
    ['nuovo', 'piuFresco'],
  )
})

test('a pari data non si spedisce niente: due dispositivi non devono rimbalzarsi il prezzo', () => {
  const locali = { 1: { price: 10_000, at: ADESSO } }
  const condivisi = { 1: { price: 11_000, at: ADESSO } }
  assert.deepEqual(daInviare(locali, condivisi), [])
})

test('quello che arriva dal server entra nel listino', () => {
  const esito = applicaRemoti({}, [{ id: '1', price: 10_000, at: ADESSO, autore: 'Giofra' }])
  assert.equal(esito.cambiato, true)
  assert.deepEqual(esito.condivisi[1], { price: 10_000, at: ADESSO, autore: 'Giofra' })
})

test('una risposta in ritardo non fa tornare indietro il listino', () => {
  const condivisi = { 1: { price: 12_000, at: ADESSO, autore: 'Marco' } }
  const esito = applicaRemoti(condivisi, [{ id: '1', price: 9_000, at: ADESSO - 3 * ORA, autore: 'Luca' }])
  assert.equal(esito.cambiato, false)
  assert.equal(esito.condivisi[1].price, 12_000)
})

test('se non cambia nulla si restituisce lo stesso oggetto, per non far ridisegnare tutto', () => {
  const condivisi = { 1: { price: 12_000, at: ADESSO, autore: 'Marco' } }
  const esito = applicaRemoti(condivisi, [{ id: '1', price: 12_000, at: ADESSO, autore: 'Marco' }])
  assert.equal(esito.cambiato, false)
  assert.equal(esito.condivisi, condivisi)
})

test('le righe senza prezzo o senza carta vengono ignorate', () => {
  const esito = applicaRemoti({}, [{ id: '', price: 100 }, { id: '2', price: 0 }, { id: '3' }])
  assert.deepEqual(esito.condivisi, {})
})

test('i prezzi locali assorbiti dal listino si possono buttare', () => {
  const locali = {
    assorbito: { price: 10_000, at: ADESSO - ORA },
    mioPiuFresco: { price: 8_000, at: ADESSO },
    solomio: { price: 4_000, at: ADESSO },
  }
  const condivisi = {
    assorbito: { price: 10_000, at: ADESSO - ORA, autore: 'Giofra' },
    mioPiuFresco: { price: 9_000, at: ADESSO - 5 * ORA, autore: 'Marco' },
  }
  assert.deepEqual(localiSuperati(locali, condivisi), ['assorbito'])
})

test('il telefono nuovo riceve la rosa, non la cancella', () => {
  const scelta = scegliDati({
    locale: { watchlist: [], positions: [], seen: [] },
    localeAggiornatoAl: 0,
    remoto: { watchlist: [{ id: '1' }], positions: [], seen: [] },
    remotoAggiornatoAl: ADESSO - 10 * ORA,
  })
  assert.equal(scelta, 'applica')
})

test('una copia vuota non sovrascrive una piena, nemmeno se più recente', () => {
  const scelta = scegliDati({
    locale: { watchlist: [{ id: '1' }], positions: [], seen: [] },
    localeAggiornatoAl: ADESSO - 10 * ORA,
    remoto: { watchlist: [], positions: [], seen: [] },
    remotoAggiornatoAl: ADESSO,
  })
  assert.equal(scelta, 'invia')
})

test('fra due copie piene vince la più recente', () => {
  const piena = (n) => ({ watchlist: Array.from({ length: n }, (_, i) => ({ id: String(i) })), positions: [], seen: [] })
  assert.equal(
    scegliDati({ locale: piena(2), localeAggiornatoAl: ADESSO, remoto: piena(5), remotoAggiornatoAl: ADESSO - ORA }),
    'invia',
  )
  assert.equal(
    scegliDati({ locale: piena(2), localeAggiornatoAl: ADESSO - ORA, remoto: piena(5), remotoAggiornatoAl: ADESSO }),
    'applica',
  )
  assert.equal(
    scegliDati({ locale: piena(2), localeAggiornatoAl: ADESSO, remoto: piena(5), remotoAggiornatoAl: ADESSO }),
    'niente',
  )
})

test('se non c\'è niente da nessuna parte non si fa niente', () => {
  assert.equal(scegliDati({}), 'niente')
})
