import assert from 'node:assert/strict'
import { test } from 'node:test'

import { buildAlerts } from '../shared/alerts.mjs'

const ora = Date.parse('2026-09-18T10:00:00Z')
const quote = (price) => ({ price, minPrice: price, maxPrice: price, changePercent: 0, updated: 'test' })

test('avvisa quando un giocatore della watchlist scende sotto il target', () => {
  const avvisi = buildAlerts({
    now: ora,
    quotes: { '1': quote(9_000) },
    watchlist: [{ id: '1', name: 'Tizio', buyTarget: 10_000, sellTarget: 15_000 }],
  })
  assert.equal(avvisi.length, 1)
  assert.equal(avvisi[0].kind, 'compra')
  assert.equal(avvisi[0].severity, 'urgente')
})

test('avvisa quando una carta in magazzino supera il margine voluto', () => {
  const avvisi = buildAlerts({
    now: ora,
    quotes: { '1': quote(13_000) },
    positions: [{ id: 'p1', playerId: '1', name: 'Tizio', quantity: 2, buyPrice: 10_000, sellPrice: null }],
    settings: { taxPercent: 5, targetMarginPercent: 15 },
  })
  assert.equal(avvisi.length, 1)
  assert.equal(avvisi[0].kind, 'vendi')
  // In italiano i numeri di quattro cifre non vogliono il separatore: 4700.
  assert.match(avvisi[0].body, /4700 crediti netti \(\+24%\)/)
})

test('non avvisa per le posizioni già chiuse', () => {
  const avvisi = buildAlerts({
    now: ora,
    quotes: { '1': quote(13_000) },
    positions: [{ id: 'p1', playerId: '1', name: 'Tizio', quantity: 1, buyPrice: 10_000, sellPrice: 13_000 }],
  })
  assert.equal(avvisi.length, 0)
})

test('lo stesso avviso non cambia identificativo finché la situazione è uguale', () => {
  const context = {
    now: ora,
    quotes: { '1': quote(9_000) },
    watchlist: [{ id: '1', name: 'Tizio', buyTarget: 10_000, sellTarget: 15_000 }],
  }
  const primo = buildAlerts(context)[0]
  const secondo = buildAlerts({ ...context, now: ora + 60_000 })[0]
  assert.equal(primo.id, secondo.id)
})

test('un evento imminente diventa un avviso informativo', () => {
  const avvisi = buildAlerts({
    now: ora,
    events: [{ id: 'e1', label: 'Premi Champions', detail: 'Ondata di pacchetti', at: ora + 2 * 3_600_000, effect: 'offerta' }],
  })
  assert.equal(avvisi.length, 1)
  assert.match(avvisi[0].title, /Fra circa 2 ore/)
})

test('non segnala come occasione un giocatore già in watchlist', () => {
  const opportunity = {
    player: { id: '1', name: 'Tizio', rating: 85 },
    score: 88,
    action: 'compra',
    reasons: [{ label: 'Sotto la media settimanale', weight: 20 }],
    buyBelow: 9_000,
    sellAt: 11_000,
    expectedProfit: 1_450,
    confidence: 'alta',
    catalysts: [],
    overBudget: false,
  }
  const senzaLista = buildAlerts({ now: ora, opportunities: [opportunity] })
  assert.equal(senzaLista.length, 1)
  const conLista = buildAlerts({
    now: ora,
    opportunities: [opportunity],
    watchlist: [{ id: '1', name: 'Tizio', buyTarget: 0, sellTarget: 0 }],
  })
  assert.equal(conLista.length, 0)
})

test('un verdetto «vendi ora» diventa un avviso urgente', () => {
  const avvisi = buildAlerts({
    now: ora,
    sellVerdicts: [
      {
        player: { id: '1', name: 'Tizio', rating: 85 },
        score: 80,
        action: 'vendi-ora',
        reasons: [{ label: 'Prezzo sui massimi delle ultime settimane', weight: 18 }],
        askPrice: 15_000,
        netNow: 4_250,
        gainPercent: 42,
        catalysts: [],
      },
    ],
  })
  assert.equal(avvisi.length, 1)
  assert.equal(avvisi[0].severity, 'urgente')
  assert.match(avvisi[0].title, /Momento di vendere/)
})

test('non manda due avvisi di vendita per la stessa carta', () => {
  const avvisi = buildAlerts({
    now: ora,
    quotes: { '1': quote(13_000) },
    positions: [{ id: 'p1', playerId: '1', name: 'Tizio', quantity: 1, buyPrice: 10_000, sellPrice: null }],
    settings: { taxPercent: 5, targetMarginPercent: 15 },
    sellVerdicts: [
      {
        player: { id: '1', name: 'Tizio', rating: 85 },
        score: 80,
        action: 'vendi-ora',
        reasons: [{ label: 'Sui massimi', weight: 18 }],
        askPrice: 13_000,
        netNow: 2_350,
        gainPercent: 23,
        catalysts: [],
      },
    ],
  })
  assert.equal(avvisi.filter((avviso) => avviso.kind === 'vendi').length, 1)
})
