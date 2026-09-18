// L'anno del gioco cambia ogni settembre e compare negli indirizzi di Futbin.
// Qui si verifica che l'app lo trovi da sola, contro un finto Futbin che
// risponde solo per un anno preciso.

import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { after, before, test } from 'node:test'

const GIOCATORE = { id: '999', full_name: 'Prova Uno', rating: 88, position: 'ST', club: 'Test FC', nation: 'Italy' }

let server
let futbin

before(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url, 'http://x')
    res.writeHead(200, { 'content-type': 'application/json' })

    if (url.pathname === '/search') {
      // Solo l'anno 26 conosce questo giocatore: il 27 non esiste ancora.
      const anno = url.searchParams.get('year')
      res.end(JSON.stringify(anno === '26' ? [GIOCATORE] : []))
      return
    }
    if (url.pathname === '/26/playerPrices') {
      res.end(JSON.stringify({ 999: { prices: { ps: { LCPrice: '12,000', MinPrice: '11,000', MaxPrice: '13,000', PRP: '3', updated: 'ora' } } } }))
      return
    }
    // Qualsiasi indirizzo con un anno diverso non ha dati.
    res.end(JSON.stringify({}))
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  process.env.FUTBIN_BASE = `http://127.0.0.1:${port}`
  process.env.FUT_YEAR = '27' // configurato sull'anno sbagliato di proposito
  process.env.FUTBIN_MIN_INTERVAL_MS = '0'
  futbin = await import('../server/futbin.mjs')
})

after(() => server?.close())

test("parte dall'anno configurato ma adotta quello che risponde davvero", async () => {
  assert.equal(futbin.futbinConfig.configuredYear, '27')
  const trovati = await futbin.searchPlayers('prova')
  assert.equal(trovati.length, 1)
  assert.equal(trovati[0].name, 'Prova Uno')
  assert.equal(futbin.futbinConfig.year, '26')
})

test("i prezzi usano l'anno trovato, non quello configurato", async () => {
  const prezzi = await futbin.fetchPrices('999')
  assert.equal(prezzi.ps.price, 12_000)
  assert.equal(prezzi.ps.minPrice, 11_000)
})
