import assert from 'node:assert/strict'
import { test } from 'node:test'

import { currentPhase, romeParts, upcomingEvents } from '../shared/calendar.mjs'
import { matchesPlayer, normalizeCatalyst } from '../shared/catalysts.mjs'
import { breakEvenSell, maxBuyForMargin, profit, roundToMarketStep, signalFor } from '../shared/market.mjs'
import { priceSignals, scorePlayer } from '../shared/scoring.mjs'

// --- matematica del mercato -------------------------------------------------

test('la tassa del 5% rende in perdita una rivendita allo stesso prezzo', () => {
  assert.equal(Math.round(profit(10_000, 10_000)), -500)
})

test('il prezzo di pareggio copre esattamente la tassa', () => {
  const pareggio = breakEvenSell(10_000)
  assert.ok(Math.abs(profit(10_000, pareggio)) < 0.01)
})

test('il BIN massimo per un margine del 15% produce davvero quel margine', () => {
  const bin = maxBuyForMargin(12_000, 15)
  const margine = (profit(bin, 12_000) / bin) * 100
  assert.ok(margine >= 15, `margine ottenuto ${margine}`)
  assert.ok(margine < 16, `margine troppo alto ${margine}`)
})

test('gli arrotondamenti restano sugli scalini accettati dal gioco', () => {
  assert.equal(roundToMarketStep(9_913), 9_900)
  assert.equal(roundToMarketStep(157_890), 157_000)
  assert.equal(roundToMarketStep(940), 900)
})

test('i segnali della watchlist rispettano i target', () => {
  assert.equal(signalFor(1_000, 1_200, 2_000), 'compra')
  assert.equal(signalFor(2_500, 1_200, 2_000), 'vendi')
  assert.equal(signalFor(1_500, 1_200, 2_000), 'attendi')
})

// --- calendario -------------------------------------------------------------

test('il venerdì sera è la fase di uscita promo', () => {
  assert.equal(currentPhase(new Date('2026-09-18T18:00:00Z')).id, 'hype-promo')
})

test('il giovedì mattina è la finestra di acquisto dei premi', () => {
  const fase = currentPhase(new Date('2026-09-17T08:00:00Z')) // 10:00 in Italia
  assert.equal(fase.id, 'crollo-premi')
  assert.ok(fase.bias > 0)
})

test('la notte infrasettimanale spinge a comprare', () => {
  assert.equal(currentPhase(new Date('2026-09-16T01:00:00Z')).id, 'notte')
})

test('gli orari sono calcolati sul fuso italiano, non su quello del dispositivo', () => {
  const parts = romeParts(new Date('2026-09-18T18:00:00Z'))
  assert.deepEqual(parts, { weekday: 5, hour: 20, minute: 0 })
})

test('i prossimi eventi sono futuri e in ordine', () => {
  const ora = new Date('2026-09-18T18:00:00Z')
  const eventi = upcomingEvents(ora, 4)
  assert.equal(eventi.length, 4)
  for (const evento of eventi) assert.ok(evento.at > ora.getTime())
  const ordinati = [...eventi].sort((a, b) => a.at - b.at)
  assert.deepEqual(eventi.map((e) => e.at), ordinati.map((e) => e.at))
})

// --- catalizzatori ----------------------------------------------------------

const sbcSerieA = normalizeCatalyst({
  id: 'sbc-1',
  kind: 'sbc',
  title: 'SBC Serie A 84+',
  match: { minRating: 84, leagues: ['Serie A'] },
  impact: 3,
})

test('la SBC coinvolge chi rispetta lega e valutazione', () => {
  assert.ok(matchesPlayer(sbcSerieA, { rating: 86, league: 'Serie A', nation: 'Italia' }))
})

test('la SBC esclude chi è sotto la valutazione richiesta', () => {
  assert.equal(matchesPlayer(sbcSerieA, { rating: 82, league: 'Serie A' }), false)
})

test('la SBC esclude le altre leghe', () => {
  assert.equal(matchesPlayer(sbcSerieA, { rating: 88, league: 'Premier League' }), false)
})

// --- punteggio --------------------------------------------------------------

const giocatore = { id: '1', name: 'Tizio', rating: 85, league: 'Serie A', nation: 'Italia', club: 'Inter', position: 'CM' }
const quote = (price, change = 0) => ({ price, minPrice: price, maxPrice: price, changePercent: change, updated: 'test' })
const storico = (prezzi) => prezzi.map((price, index) => ({ t: index * 86_400_000, price }))

test('il prezzo sotto la media settimanale alza il punteggio', () => {
  const alto = scorePlayer({ player: giocatore, quote: quote(10_000), history: storico([12_000, 12_000, 12_000, 12_000, 12_000, 12_000, 10_000]) })
  const piatto = scorePlayer({ player: giocatore, quote: quote(12_000), history: storico([12_000, 12_000, 12_000, 12_000, 12_000, 12_000, 12_000]) })
  assert.ok(alto.score > piatto.score, `${alto.score} deve superare ${piatto.score}`)
})

test('una SBC che chiede la carta si vede fra le ragioni', () => {
  const risultato = scorePlayer({
    player: giocatore,
    quote: quote(10_000),
    history: storico([10_000, 10_000, 10_000, 10_000, 10_000, 10_000, 10_000]),
    catalysts: [sbcSerieA],
  })
  assert.ok(risultato.reasons.some((reason) => reason.label.includes('SBC Serie A 84+')))
  assert.equal(risultato.catalysts.length, 1)
})

test('il prezzo di acquisto consigliato garantisce il margine richiesto', () => {
  const risultato = scorePlayer({
    player: giocatore,
    quote: quote(10_000),
    history: storico([12_000, 12_000, 11_500, 11_000, 11_000, 10_500, 10_000]),
    settings: { taxPercent: 5, targetMarginPercent: 20 },
  })
  const margine = (profit(risultato.buyBelow, risultato.sellAt, 5) / risultato.buyBelow) * 100
  assert.ok(margine >= 20, `margine ${margine}`)
})

test('senza prezzo non si consiglia nulla', () => {
  const risultato = scorePlayer({ player: giocatore, quote: null })
  assert.equal(risultato.score, 0)
  assert.equal(risultato.action, 'evita')
})

test('una carta già in magazzino e in utile si consiglia di venderla', () => {
  const risultato = scorePlayer({
    player: giocatore,
    quote: quote(15_000),
    history: storico([10_000, 11_000, 12_000, 13_000, 14_000, 15_000, 15_000]),
    settings: { taxPercent: 5, targetMarginPercent: 15 },
    position: { buyPrice: 10_000, quantity: 1 },
  })
  assert.equal(risultato.action, 'vendi')
})

test('i segnali di prezzo riconoscono minimo, massimo e posizione', () => {
  const signals = priceSignals(10_000, storico([12_000, 11_000, 10_000]), null)
  assert.equal(signals.low, 10_000)
  assert.equal(signals.high, 12_000)
  assert.equal(signals.position, 0)
})

test('una SBC scritta in inglese trova i giocatori del dataset italiano', () => {
  const sbcItaly = normalizeCatalyst({
    kind: 'sbc',
    title: 'Italy Marquee Matchups',
    match: { nations: ['Italy'] },
  })
  assert.ok(matchesPlayer(sbcItaly, { rating: 86, nation: 'Italia', league: 'Serie A' }))
  assert.equal(matchesPlayer(sbcItaly, { rating: 86, nation: 'Francia', league: 'Ligue 1' }), false)
})

test('senza un motivo concreto non si dice mai «compra ora»', () => {
  // Prezzo piatto da due settimane: nessun calo, nessuna SBC. Il momento
  // favorevole della settimana da solo non basta.
  const fasePiuFavorevole = { id: 'pre-promo', label: 'Vigilia della promo', advice: '', bias: 3 }
  const risultato = scorePlayer({
    player: giocatore,
    quote: quote(10_000),
    history: storico(Array.from({ length: 10 }, () => 10_000)),
    phase: fasePiuFavorevole,
  })
  assert.notEqual(risultato.action, 'compra')
})

test('con calo marcato e SBC attiva il consiglio diventa «compra ora»', () => {
  const risultato = scorePlayer({
    player: giocatore,
    quote: quote(8_500, -9),
    history: storico([12_000, 12_000, 11_500, 11_000, 10_500, 10_000, 8_500]),
    catalysts: [sbcSerieA],
    phase: { id: 'crollo-premi', label: 'Premi in consegna', advice: '', bias: 3 },
  })
  assert.equal(risultato.action, 'compra')
  assert.ok(risultato.score >= 72, `punteggio ${risultato.score}`)
})

test('senza storico il consiglio resta prudente', () => {
  const risultato = scorePlayer({
    player: giocatore,
    quote: quote(8_500, -12),
    history: [],
    catalysts: [sbcSerieA],
    phase: { id: 'crollo-premi', label: 'Premi in consegna', advice: '', bias: 3 },
  })
  assert.notEqual(risultato.action, 'compra')
  assert.equal(risultato.confidence, 'bassa')
})
