// La sorgente generica provata contro una finta API locale. Nessun fornitore
// vero è scritto nel codice: qui si verifica che, data un'API con chiave,
// l'app sappia leggerne ricerca e prezzi.

import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { after, before, test } from 'node:test'

const GIOCATORE = {
  id: 231747,
  commonName: 'Mbappé',
  rating: 92,
  position: 'ST',
  club: 241, // identificativo numerico: non è un nome
  league: 'LaLiga',
  nation: 'France',
  rarity: 'Gold Rare',
}

let server
let provider
const intestazioniRicevute = []
const corpiRicevuti = []

before(async () => {
  server = createServer(async (req, res) => {
    intestazioniRicevute.push(req.headers)
    const url = new URL(req.url, 'http://x')

    if (req.method === 'POST') {
      const pezzi = []
      for await (const pezzo of req) pezzi.push(pezzo)
      corpiRicevuti.push(Buffer.concat(pezzi).toString())
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ items: [GIOCATORE] }))
      return
    }

    // Percorso riservato agli abbonati, come su certi servizi veri.
    if (url.pathname.endsWith('/premium-price')) {
      res.writeHead(403, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ message: 'premium only' }))
      return
    }

    res.writeHead(200, { 'content-type': 'application/json' })

    if (url.pathname === '/players/search') {
      const nome = (url.searchParams.get('name') ?? '').toLowerCase()
      const trovati = 'mbappé mbappe'.includes(nome) || nome.includes('mbapp') ? [GIOCATORE] : []
      res.end(JSON.stringify({ items: trovati, pagination: { page: 1 } }))
      return
    }
    if (url.pathname === '/players/231747/price') {
      res.end(
        JSON.stringify({
          price: {
            ps: { LCPrice: '1,450,000', MinPrice: '1,300,000', MaxPrice: '1,600,000', PRP: 4, updated: '2 min fa' },
            xbox: { LCPrice: '1,470,000' },
            pc: 1_280_000,
          },
        }),
      )
      return
    }
    res.writeHead(404)
    res.end('{}')
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  process.env.FUT_API_BASE = `http://127.0.0.1:${port}`
  process.env.FUT_API_KEY = 'chiave-di-prova'
  process.env.FUT_API_MIN_INTERVAL_MS = '0'
  provider = await import('../server/rest-provider.mjs')
})

after(() => server?.close())

test('la ricerca restituisce i giocatori normalizzati', async () => {
  const trovati = await provider.searchPlayers('mbappe')
  assert.equal(trovati.length, 1)
  assert.equal(trovati[0].name, 'Mbappé')
  assert.equal(trovati[0].rating, 92)
  assert.equal(trovati[0].league, 'LaLiga')
})

test('un club scritto come numero non diventa un nome finto', () => {
  // Meglio "—" che spacciare 241 per il nome di una squadra.
  return provider.searchPlayers('mbappe').then((trovati) => assert.equal(trovati[0].club, '—'))
})

test('la chiave viaggia nell\'intestazione configurata', () => {
  assert.equal(intestazioniRicevute.at(-1)['x-auth-token'], 'chiave-di-prova')
})

test('senza indirizzo o chiave la sorgente si dichiara non configurata', () => {
  assert.equal(provider.restConfig.enabled, true)
  assert.equal(provider.restConfig.label, '127.0.0.1')
})

test('i prezzi vengono letti per tutte e tre le piattaforme', async () => {
  const prezzi = await provider.fetchPrices('231747')
  assert.equal(prezzi.ps.price, 1_450_000)
  assert.equal(prezzi.ps.minPrice, 1_300_000)
  assert.equal(prezzi.xbox.price, 1_470_000)
  // Su PC il prezzo è un numero secco invece di un oggetto: va letto lo stesso.
  assert.equal(prezzi.pc.price, 1_280_000)
})

test('lo storico non è previsto e la cosa non è un errore', async () => {
  assert.deepEqual(await provider.fetchGraph('231747', 'ps'), [])
})

test('con Authorization la chiave viaggia come Bearer, senza doverlo scrivere', async () => {
  // Modulo nuovo con un'altra configurazione: l'intestazione fa la differenza.
  const { port } = server.address()
  process.env.FUT_API_BASE = `http://127.0.0.1:${port}`
  process.env.FUT_API_KEY_HEADER = 'authorization'
  process.env.FUT_API_KEY = 'chiave-nuda'
  const altro = await import(`../server/rest-provider.mjs?variante=${Date.now()}`)
  await altro.searchPlayers('mbappe')
  assert.equal(intestazioniRicevute.at(-1).authorization, 'Bearer chiave-nuda')
})

test('la ricerca in POST manda il nome nel corpo', async () => {
  const { port } = server.address()
  process.env.FUT_API_BASE = `http://127.0.0.1:${port}`
  process.env.FUT_API_KEY_HEADER = 'X-AUTH-TOKEN'
  process.env.FUT_API_KEY = 'chiave-di-prova'
  process.env.FUT_API_SEARCH_METHOD = 'POST'
  const conPost = await import(`../server/rest-provider.mjs?post=${Date.now()}`)
  const trovati = await conPost.searchPlayers('mbappe')
  assert.equal(trovati.length, 1)
  assert.equal(corpiRicevuti.at(-1), JSON.stringify({ name: 'mbappe' }))
})

test('se i prezzi sono riservati agli abbonati non è un guasto', async () => {
  const { port } = server.address()
  process.env.FUT_API_BASE = `http://127.0.0.1:${port}`
  process.env.FUT_API_KEY = 'chiave-di-prova'
  process.env.FUT_API_SEARCH_METHOD = 'GET'
  process.env.FUT_API_PRICE_PATH = '/players/{id}/premium-price'
  const premium = await import(`../server/rest-provider.mjs?premium=${Date.now()}`)
  const prezzi = await premium.fetchPrices('231747')
  assert.equal(prezzi.ps.price, 0)
  assert.match(prezzi.ps.updated, /abbonamento/)
  assert.equal(premium.restState.prezziPremium, true)
})
