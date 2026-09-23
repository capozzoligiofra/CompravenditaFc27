// La stima del prezzo fra un'osservazione e l'altra.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { FATTORI_BASE, finestre, profiloDaStorico, stimaPrezzo, tendenzaGiornaliera } from '../shared/forecast.mjs'

const GIORNO = 86_400_000
// Mercoledì 16 settembre 2026, 15:00 in Italia: fase tranquilla di metà settimana.
const MERCOLEDI = Date.parse('2026-09-16T13:00:00Z')
const VENERDI_SERA = Date.parse('2026-09-18T18:00:00Z') // uscita promo
const GIOVEDI_MATTINA = Date.parse('2026-09-17T08:00:00Z') // premi

const storico = (prezzi, fine = MERCOLEDI) =>
  prezzi.map((price, indice) => ({ t: fine - (prezzi.length - 1 - indice) * GIORNO, price }))

test('senza osservazioni non si inventa un prezzo', () => {
  const stima = stimaPrezzo({ history: [], now: MERCOLEDI })
  assert.equal(stima.price, 0)
  assert.equal(stima.confidenza, 'nessuna')
})

test('appena segnato, il prezzo stimato è quello segnato', () => {
  const stima = stimaPrezzo({ history: [{ t: MERCOLEDI, price: 10_000 }], now: MERCOLEDI })
  assert.equal(stima.price, 10_000)
})

test("nella fase di uscita promo la stima sale rispetto a un prezzo segnato a metà settimana", () => {
  const stima = stimaPrezzo({ history: [{ t: MERCOLEDI, price: 10_000 }], now: VENERDI_SERA })
  assert.ok(stima.price > 10_000, `stimato ${stima.price}`)
  assert.ok(stima.price < 12_500, 'e non deve esagerare')
})

test('nella finestra dei premi la stima scende', () => {
  const stima = stimaPrezzo({ history: [{ t: MERCOLEDI - GIORNO, price: 10_000 }], now: GIOVEDI_MATTINA })
  assert.ok(stima.price < 10_000, `stimato ${stima.price}`)
})

test('la stima non si allontana mai oltre un quarto dal prezzo osservato', () => {
  const inCrescita = storico([5_000, 6_500, 8_000, 9_500, 11_000])
  const stima = stimaPrezzo({ history: inCrescita, now: MERCOLEDI + 20 * GIORNO })
  assert.ok(stima.price <= Math.round(11_000 * 1.25), `stimato ${stima.price}`)
})

test("l'affidabilità scende con il passare dei giorni", () => {
  const punti = storico([9_000, 9_200, 9_400, 9_600, 9_800])
  assert.equal(stimaPrezzo({ history: punti, now: MERCOLEDI }).confidenza, 'alta')
  assert.equal(stimaPrezzo({ history: punti, now: MERCOLEDI + 2 * GIORNO }).confidenza, 'media')
  assert.equal(stimaPrezzo({ history: punti, now: MERCOLEDI + 5 * GIORNO }).confidenza, 'bassa')
  assert.equal(stimaPrezzo({ history: punti, now: MERCOLEDI + 20 * GIORNO }).confidenza, 'molto bassa')
})

test('la tendenza giornaliera riconosce salita e discesa', () => {
  assert.ok(tendenzaGiornaliera(storico([10_000, 10_500, 11_000])) > 0)
  assert.ok(tendenzaGiornaliera(storico([11_000, 10_500, 10_000])) < 0)
  assert.equal(tendenzaGiornaliera(storico([10_000, 10_000])), 0)
})

test('con pochi dati si usano i fattori di partenza', () => {
  const profilo = profiloDaStorico(storico([10_000, 10_100]))
  assert.equal(profilo.imparato, false)
  assert.deepEqual(profilo.fattori, FATTORI_BASE)
})

test('con abbastanza prezzi tuoi il profilo si adatta', () => {
  // Tre settimane di prezzi: bassi il giovedì dei premi, alti il venerdì sera.
  const punti = []
  for (let settimana = 0; settimana < 3; settimana += 1) {
    punti.push({ t: GIOVEDI_MATTINA - settimana * 7 * GIORNO, price: 8_000 })
    punti.push({ t: VENERDI_SERA - settimana * 7 * GIORNO, price: 12_000 })
    punti.push({ t: MERCOLEDI - settimana * 7 * GIORNO, price: 10_000 })
  }
  const profilo = profiloDaStorico(punti)
  assert.equal(profilo.imparato, true)
  assert.ok(profilo.fattori['crollo-premi'] < profilo.fattori['hype-promo'])
})

test('indica quando conviene comprare e quando vendere nei prossimi giorni', () => {
  const risultato = finestre({ history: [{ t: MERCOLEDI, price: 10_000 }], now: MERCOLEDI })
  assert.ok(risultato.acquisto && risultato.vendita)
  assert.ok(risultato.acquisto.variazioneAttesa < 0, 'comprare quando il prezzo è atteso più basso')
  assert.ok(risultato.vendita.variazioneAttesa > 0, 'vendere quando è atteso più alto')
  assert.ok(risultato.acquisto.quando > MERCOLEDI && risultato.vendita.quando > MERCOLEDI)
})
