// I doppioni: quali si uniscono, quali no, e cosa succede ai dati.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { applicaUnioni, mappaUnioni, trovaDoppioni, unisciStorico } from '../shared/duplicates.mjs'
import { creaCarta, idCarta } from '../shared/catalog.mjs'

const GIORNO = 86_400_000

const carta = (nome, voto = 0, extra = {}) => ({ ...creaCarta({ name: nome, rating: voto }), ...extra })

test('il segnaposto senza voto si unisce alla carta del catalogo', () => {
  const { unioni, ambigui } = trovaDoppioni([carta('Klara Bühl'), carta('Klara Bühl', 88)])
  assert.equal(ambigui.length, 0)
  assert.deepEqual(unioni, [{ da: idCarta('Klara Bühl', 0), a: idCarta('Klara Bühl', 88), nome: 'Klara Bühl', voto: 88 }])
})

test('accenti e maiuscole non impediscono di riconoscere lo stesso giocatore', () => {
  const { unioni } = trovaDoppioni([carta('lautaro martinez'), carta('Lautaro Martínez', 89)])
  assert.equal(unioni.length, 1)
  assert.equal(unioni[0].a, idCarta('Lautaro Martínez', 89))
})

test('due giocatori diversi con lo stesso nome non si uniscono a indovinare', () => {
  // «Vitinha 90» e «Vitinha 75» sono due persone: un «Vitinha» senza voto
  // potrebbe essere l'uno o l'altro, e sbagliare vorrebbe dire spostare un
  // prezzo sulla carta sbagliata per tutti.
  const { unioni, ambigui } = trovaDoppioni([carta('Vitinha'), carta('Vitinha', 90, { club: 'PSG' }), carta('Vitinha', 75)])
  assert.deepEqual(unioni, [])
  assert.equal(ambigui.length, 1)
  assert.deepEqual(
    ambigui[0].candidati.map((c) => c.voto),
    [90, 75],
  )
})

test('le carte con il voto non sono doppioni fra loro', () => {
  const { unioni, ambigui } = trovaDoppioni([carta('Marquinhos', 87), carta('Marquinhos', 71), carta('Marquinhos', 61)])
  assert.deepEqual(unioni, [])
  assert.deepEqual(ambigui, [])
})

test('un nome senza corrispondenze nel catalogo resta dov’è', () => {
  const { unioni, ambigui } = trovaDoppioni([carta('Uno Mai Visto'), carta('Klara Bühl', 88)])
  assert.deepEqual(unioni, [])
  assert.deepEqual(ambigui, [])
})

test('le catene si risolvono fino in fondo', () => {
  const mappa = mappaUnioni([
    { da: 'a', a: 'b' },
    { da: 'b', a: 'c' },
  ])
  assert.equal(mappa.get('a'), 'c')
  assert.equal(mappa.get('b'), 'c')
})

test('una catena che gira su se stessa non blocca il programma', () => {
  const mappa = mappaUnioni([
    { da: 'a', a: 'b' },
    { da: 'b', a: 'a' },
  ])
  assert.equal(mappa.size, 2)
})

test('unendo due storici resta un punto al giorno, il più recente', () => {
  const punti = unisciStorico(
    [{ t: 10 * GIORNO, price: 1000 }, { t: 11 * GIORNO, price: 1100 }],
    [{ t: 11 * GIORNO + 3600_000, price: 1200 }, { t: 12 * GIORNO, price: 1300 }],
  )
  assert.deepEqual(
    punti.map((p) => p.price),
    [1000, 1200, 1300],
  )
})

test('unire sposta il prezzo, lo storico, la rosa e la watchlist', () => {
  const vecchio = idCarta('Klara Bühl', 0)
  const nuovo = idCarta('Klara Bühl', 88)
  const data = {
    seen: [carta('Klara Bühl'), carta('Klara Bühl', 88, { club: 'Bayern' })],
    watchlist: [{ id: vecchio, name: 'Klara Bühl', rating: 0, buyTarget: 7000, sellTarget: 9000 }],
    positions: [{ id: 'p1', playerId: vecchio, quantity: 1 }],
    alerts: [{ id: 'a1', playerId: vecchio }, { id: 'a2', playerId: null }],
    manualPrices: { [vecchio]: { price: 8200, at: 2000 } },
    sharedPrices: { [vecchio]: { price: 8000, at: 1000 }, [nuovo]: { price: 8300, at: 3000 } },
    sharedPlayers: { [vecchio]: { name: 'Klara Bühl', rating: 0 } },
    priceHistory: { [vecchio]: [{ t: 10 * GIORNO, price: 8000 }], [nuovo]: [{ t: 11 * GIORNO, price: 8300 }] },
  }

  const { unioni } = trovaDoppioni(data.seen)
  const { data: dopo, unite } = applicaUnioni(data, unioni)

  assert.equal(unite, 1)
  assert.equal(dopo.seen.length, 1)
  assert.equal(dopo.seen[0].id, nuovo)
  assert.equal(dopo.seen[0].club, 'Bayern', 'resta la carta con i dati, non il segnaposto')
  assert.equal(dopo.watchlist[0].id, nuovo)
  assert.equal(dopo.watchlist[0].rating, 88, 'la watchlist prende la valutazione buona')
  assert.equal(dopo.watchlist[0].buyTarget, 7000, 'i target restano i tuoi')
  assert.equal(dopo.positions[0].playerId, nuovo)
  assert.equal(dopo.alerts[0].playerId, nuovo)
  assert.equal(dopo.alerts[1].playerId, null)
  assert.deepEqual(dopo.manualPrices, { [nuovo]: { price: 8200, at: 2000 } })
  assert.deepEqual(dopo.sharedPrices, { [nuovo]: { price: 8300, at: 3000 } }, 'vince l’osservazione più recente')
  assert.equal(dopo.sharedPlayers[nuovo].rating, 88)
  assert.deepEqual(
    dopo.priceHistory[nuovo].map((p) => p.price),
    [8000, 8300],
    'i due storici diventano uno',
  )
  assert.equal(dopo.priceHistory[vecchio], undefined)
})

test('la stessa carta in watchlist due volte diventa una', () => {
  const vecchio = idCarta('Klara Bühl', 0)
  const nuovo = idCarta('Klara Bühl', 88)
  const data = {
    seen: [carta('Klara Bühl'), carta('Klara Bühl', 88)],
    watchlist: [
      { id: nuovo, name: 'Klara Bühl', rating: 88, buyTarget: 7500 },
      { id: vecchio, name: 'Klara Bühl', rating: 0, buyTarget: 7000 },
    ],
  }
  const { unioni } = trovaDoppioni(data.seen)
  const { data: dopo } = applicaUnioni(data, unioni)
  assert.equal(dopo.watchlist.length, 1)
  assert.equal(dopo.watchlist[0].buyTarget, 7500, 'resta la voce che c’era già')
})

test('senza doppioni non si tocca niente', () => {
  const data = { seen: [carta('Klara Bühl', 88)], watchlist: [], manualPrices: {} }
  const { unioni } = trovaDoppioni(data.seen)
  const esito = applicaUnioni(data, unioni)
  assert.equal(esito.unite, 0)
  assert.equal(esito.data, data, 'lo stesso oggetto: nessun ridisegno inutile')
})
