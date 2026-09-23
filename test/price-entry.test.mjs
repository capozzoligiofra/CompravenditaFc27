// L'elenco delle carte a cui serve un prezzo.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { filtraVoci, ordinaVoci, riepilogo, statoPrezzo, vociPrezzo } from '../shared/price-entry.mjs'

const ORA = 3_600_000
const GIORNO = 24 * ORA
const ADESSO = Date.parse('2026-09-23T10:00:00Z')

test('un prezzo di stamattina è fresco, quello di tre giorni fa no', () => {
  assert.equal(statoPrezzo(ADESSO - 2 * ORA, ADESSO), 'oggi')
  assert.equal(statoPrezzo(ADESSO - 3 * GIORNO, ADESSO), 'vecchio')
  assert.equal(statoPrezzo(0, ADESSO), 'mai')
})

test('rosa, watchlist e schede aperte confluiscono in un elenco solo', () => {
  const voci = vociPrezzo({
    positions: [{ playerId: '1', name: 'Kean', rating: 84, quantity: 2, sellPrice: null }],
    watchlist: [{ id: '2', name: 'Bastoni', rating: 85 }],
    seen: [{ id: '3', name: 'Leao', rating: 86 }],
    now: ADESSO,
  })
  assert.deepEqual(
    voci.map((voce) => voce.id).sort(),
    ['1', '2', '3'],
  )
  assert.deepEqual(voci.find((voce) => voce.id === '1').gruppi, ['rosa'])
  assert.equal(voci.find((voce) => voce.id === '1').quantita, 2)
})

test('la stessa carta in rosa e in watchlist compare una volta sola', () => {
  const voci = vociPrezzo({
    positions: [{ playerId: '1', name: 'Kean', rating: 84, quantity: 1, sellPrice: null }],
    watchlist: [{ id: '1', name: 'Moise Kean', rating: 84 }],
    now: ADESSO,
  })
  assert.equal(voci.length, 1)
  assert.deepEqual(voci[0].gruppi, ['rosa', 'watchlist'])
  // Fra i due nomi resta quello più completo.
  assert.equal(voci[0].name, 'Moise Kean')
})

test('le carte già vendute non chiedono un prezzo', () => {
  const voci = vociPrezzo({
    positions: [
      { playerId: '1', name: 'Kean', quantity: 1, sellPrice: 50_000 },
      { playerId: '2', name: 'Leao', quantity: 1, sellPrice: null },
    ],
    now: ADESSO,
  })
  assert.deepEqual(
    voci.map((voce) => voce.id),
    ['2'],
  )
})

test('prima le carte senza prezzo, poi quelle con il prezzo più vecchio', () => {
  const voci = vociPrezzo({
    seen: [
      { id: 'fresca', name: 'Fresca', rating: 84 },
      { id: 'vecchia', name: 'Vecchia', rating: 84 },
      { id: 'mai', name: 'Mai', rating: 84 },
      { id: 'vecchissima', name: 'Vecchissima', rating: 84 },
    ],
    manualPrices: {
      fresca: { price: 10_000, at: ADESSO - ORA },
      vecchia: { price: 20_000, at: ADESSO - 2 * GIORNO },
      vecchissima: { price: 30_000, at: ADESSO - 9 * GIORNO },
    },
    now: ADESSO,
  })
  assert.deepEqual(
    voci.map((voce) => voce.id),
    ['mai', 'vecchissima', 'vecchia', 'fresca'],
  )
})

test('fra prezzo scritto a mano e storico vince il più recente', () => {
  const [voce] = vociPrezzo({
    seen: [{ id: '1', name: 'Kean', rating: 84 }],
    manualPrices: { 1: { price: 10_000, at: ADESSO - 5 * GIORNO } },
    priceHistory: { 1: [{ t: ADESSO - 2 * GIORNO, price: 12_000 }] },
    now: ADESSO,
  })
  assert.equal(voce.prezzo, 12_000)
  assert.equal(voce.osservatoIl, ADESSO - 2 * GIORNO)
  assert.equal(voce.scrittoAMano, false)
  assert.equal(voce.stato, 'vecchio')
})

test('il filtro per gruppo e per nome restringe l\'elenco', () => {
  const voci = vociPrezzo({
    positions: [{ playerId: '1', name: 'Moise Kean', rating: 84, quantity: 1, sellPrice: null }],
    watchlist: [{ id: '2', name: 'Alessandro Bastoni', rating: 85 }],
    now: ADESSO,
  })
  assert.equal(filtraVoci(voci, { gruppo: 'rosa' }).length, 1)
  assert.equal(filtraVoci(voci, { gruppo: 'watchlist' })[0].id, '2')
  // Gli accenti e le maiuscole non devono contare.
  assert.equal(filtraVoci(voci, { testo: 'KEAN' })[0].id, '1')
  assert.equal(filtraVoci(voci, { testo: 'nessuno' }).length, 0)
})

test('«da aggiornare» lascia fuori solo le carte segnate oggi', () => {
  const voci = vociPrezzo({
    seen: [
      { id: 'fresca', name: 'Fresca', rating: 84 },
      { id: 'vecchia', name: 'Vecchia', rating: 84 },
      { id: 'mai', name: 'Mai', rating: 84 },
    ],
    manualPrices: {
      fresca: { price: 10_000, at: ADESSO - ORA },
      vecchia: { price: 20_000, at: ADESSO - 3 * GIORNO },
    },
    now: ADESSO,
  })
  assert.deepEqual(
    filtraVoci(voci, { gruppo: 'da-aggiornare' }).map((voce) => voce.id),
    ['mai', 'vecchia'],
  )
  assert.deepEqual(riepilogo(voci), { totale: 3, aggiornate: 1, daAggiornare: 2, mai: 1 })
})

test('a parità di anzianità conta la valutazione, e l\'ordine non muta l\'originale', () => {
  const voci = [
    { id: 'a', rating: 84, osservatoIl: 0 },
    { id: 'b', rating: 89, osservatoIl: 0 },
  ]
  assert.deepEqual(
    ordinaVoci(voci).map((voce) => voce.id),
    ['b', 'a'],
  )
  assert.equal(voci[0].id, 'a')
})

test('le carte appena sistemate restano visibili e al loro posto', () => {
  const voci = vociPrezzo({
    seen: [
      { id: 'mai', name: 'Mai', rating: 84 },
      { id: 'vecchia', name: 'Vecchia', rating: 84 },
    ],
    manualPrices: {
      // «mai» è appena stata segnata: senza accorgimenti uscirebbe dal filtro.
      mai: { price: 10_000, at: ADESSO },
      vecchia: { price: 20_000, at: ADESSO - 3 * GIORNO },
    },
    now: ADESSO,
  })
  const filtrate = filtraVoci(voci, { gruppo: 'da-aggiornare', tieni: ['mai'] })
  assert.deepEqual(
    filtrate.map((voce) => voce.id).sort(),
    ['mai', 'vecchia'],
  )
  // E resta prima, come quando non aveva prezzo.
  const anzianitaPrima = { mai: 0 }
  assert.deepEqual(
    ordinaVoci(filtrate, (voce) => anzianitaPrima[voce.id] ?? voce.osservatoIl).map((voce) => voce.id),
    ['mai', 'vecchia'],
  )
})

test('il filtro per nome vale anche sulle carte appena sistemate', () => {
  const voci = vociPrezzo({
    seen: [
      { id: '1', name: 'Kean', rating: 84 },
      { id: '2', name: 'Bastoni', rating: 85 },
    ],
    manualPrices: { 1: { price: 10_000, at: ADESSO } },
    now: ADESSO,
  })
  assert.deepEqual(
    filtraVoci(voci, { testo: 'bastoni', tieni: ['1'] }).map((voce) => voce.id),
    ['2'],
  )
})
