// Il parsing delle pagine di Futbin si prova contro un finto Futbin servito
// in locale: è l'unico modo per verificarlo senza dipendere dal sito vero.

import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { after, before, test } from 'node:test'

const SBC_HTML = `
<!doctype html><html><body>
  <div class="sbc-list">
    <a href="/27/squad-building-challenges/marquee-matchups"><div class="name">Marquee Matchups</div></a>
    <a href="/27/squad-building-challenges/serie-a-upgrade"><span>Serie A 84+ Upgrade</span></a>
    <a href="/27/squad-building-challenges/italy-icon"><span>Italy Icon Challenge</span></a>
    <a href="/27/squad-building-challenges/85-rated-squad">85+ Rated Squad</a>
    <a href="/27/players">Tutti i giocatori</a>
  </div>
</body></html>`

const OBJECTIVES_HTML = `
<!doctype html><html><body>
  <a href="/27/objectives/premier-league-scorer"><h3>Premier League Scorer</h3></a>
  <a href="/27/objectives/daily-login">Daily Login</a>
</body></html>`

let server
let fetchCatalysts

before(async () => {
  server = createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(req.url.includes('objectives') ? OBJECTIVES_HTML : SBC_HTML)
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address()
  process.env.FUTBIN_SBC_URL = `http://127.0.0.1:${port}/27/squad-building-challenges`
  process.env.FUTBIN_OBJECTIVES_URL = `http://127.0.0.1:${port}/27/objectives`
  process.env.FUTBIN_MIN_INTERVAL_MS = '0'
  ;({ fetchCatalysts } = await import('../server/catalysts.mjs'))
})

after(() => server?.close())

test('legge le SBC e ne ricava i requisiti dal titolo', async () => {
  const catalysts = await fetchCatalysts()
  const serieA = catalysts.find((item) => item.title === 'Serie A 84+ Upgrade')
  assert.ok(serieA, 'la SBC della Serie A deve essere riconosciuta')
  assert.equal(serieA.kind, 'sbc')
  assert.equal(serieA.match.minRating, 84)
  assert.deepEqual(serieA.match.leagues, ['Serie A'])
})

test('riconosce la nazione richiesta', async () => {
  const catalysts = await fetchCatalysts()
  const italia = catalysts.find((item) => item.title === 'Italy Icon Challenge')
  assert.deepEqual(italia.match.nations, ['Italy'])
})

test('scarta le voci senza alcun requisito riconoscibile', async () => {
  const catalysts = await fetchCatalysts()
  assert.equal(catalysts.some((item) => item.title === 'Marquee Matchups'), false)
  assert.equal(catalysts.some((item) => item.title === 'Daily Login'), false)
  assert.equal(catalysts.some((item) => item.title === 'Tutti i giocatori'), false)
})

test('prende anche gli obiettivi con un requisito nel titolo', async () => {
  const catalysts = await fetchCatalysts()
  const obiettivo = catalysts.find((item) => item.kind === 'obiettivo')
  assert.equal(obiettivo.title, 'Premier League Scorer')
  assert.deepEqual(obiettivo.match.leagues, ['Premier League'])
})
