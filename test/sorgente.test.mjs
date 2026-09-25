// La sorgente automatica: le tabelle dei prezzi lette dal database.
//
// Qui si prova la parte in PHP, chiamandola davvero. Il motivo per cui
// merita un posto nella suite e' uno solo: l'identificativo della carta lo
// calcolano in due, l'app in JavaScript e il server in PHP, e se i due
// smettessero di dare lo stesso risultato i prezzi arriverebbero senza
// agganciarsi a nulla — senza un errore, senza niente in pagina.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { idCarta, leggiCsv } from '../shared/catalog.mjs'
import { chiamaPhp, phpDisponibile } from './sorgente-php.mjs'

const salta = { skip: phpDisponibile() ? false : 'php non installato' }

const NOMI_DIFFICILI = [
  ['Aitana Bonmatí', 90],
  ['Kylian Mbappé', 91],
  ['Kenan Yıldız', 84],        // «ı» senza punto: non si decompone
  ['İlkay Gündoğan', 78],      // «İ» maiuscola turca: minuscola fa i + punto
  ['Jelena Čanković', 80],
  ['Duje Ćaleta-Car', 74],
  ['Rafael Leão', 86],
  ['N’Golo Kanté', 84],   // apostrofo tipografico
  ['Lukáš Červ', 74],
  ['Vinícius Júnior', 89],
  ['Erling Haaland', 91],
  ['Nuno Mendes', 85],
]

test('php e app calcolano lo stesso identificativo', salta, () => {
  const casi = NOMI_DIFFICILI.map(([nome, voto]) => ({ funzione: 'id', nome, voto }))
  const daPhp = chiamaPhp(casi)
  const daApp = NOMI_DIFFICILI.map(([nome, voto]) => idCarta(nome, voto))
  assert.deepEqual(daPhp, daApp)
})

test('lo stesso vale dove manca intl, con la tabella degli accenti', salta, () => {
  const casi = NOMI_DIFFICILI.map(([nome, voto]) => ({ funzione: 'id', nome, voto }))
  assert.deepEqual(chiamaPhp(casi, { senzaIntl: true }), NOMI_DIFFICILI.map(([n, v]) => idCarta(n, v)))
})

test('su tutto il file dei giocatori, nemmeno un identificativo diverso', salta, () => {
  const percorso = new URL('../test/dati/nomi-veri.json', import.meta.url)
  let righe
  try {
    righe = JSON.parse(readFileSync(percorso, 'utf8'))
  } catch {
    return // il campione non c'è in questa copia: le prove sopra bastano
  }
  for (const senzaIntl of [false, true]) {
    const daPhp = chiamaPhp(righe.map(([nome, voto]) => ({ funzione: 'id', nome, voto })), { senzaIntl })
    const diversi = righe.filter(([nome, voto], i) => daPhp[i] !== idCarta(nome, voto))
    assert.equal(diversi.length, 0, `${diversi.length} diversi${senzaIntl ? ' senza intl' : ''}: ${diversi.slice(0, 3).map(([n]) => n).join(', ')}`)
  }
})

test('i prezzi si leggono in tutte le forme in cui si scrivono', salta, () => {
  const casi = [
    ['985000', 985000],
    [985000, 985000],
    ['985.000', 985000],     // punti come separatore delle migliaia
    ['1,250,000', 1250000],  // virgole, all'inglese
    ['985 000', 985000],
    ['985K', 985000],
    ['8.2K', 8200],
    ['12,5K', 12500],        // virgola decimale con la sigla
    ['1.2M', 1200000],
    ['1,45M', 1450000],
    ['0', 0],
    ['', 0],
    ['boh', 0],
    ['1.250', 1250],         // tre cifre dopo il punto: migliaia, non decimali
  ]
  const daPhp = chiamaPhp(casi.map(([valore]) => ({ funzione: 'prezzo', valore })))
  assert.deepEqual(daPhp, casi.map(([, atteso]) => atteso))
})

test('le date si leggono in tutte le forme in cui si scrivono', salta, () => {
  const [datetime, data, secondi, millisecondi, vuoto, zero] = chiamaPhp([
    { funzione: 'quando', valore: '2026-09-21 14:30:00' },
    { funzione: 'quando', valore: '2026-09-21' },
    { funzione: 'quando', valore: 1790000000 },
    { funzione: 'quando', valore: 1790000000000 },
    { funzione: 'quando', valore: '' },
    { funzione: 'quando', valore: 0 },
  ])
  assert.equal(new Date(datetime).toISOString().slice(0, 10), '2026-09-21')
  assert.equal(new Date(data).toISOString().slice(0, 10), '2026-09-21')
  assert.equal(secondi, 1790000000000, 'i secondi diventano millisecondi')
  assert.equal(millisecondi, 1790000000000, 'i millisecondi restano tali')
  assert.equal(vuoto, 0, 'vuoto vuol dire «non lo so», non il 1970')
  assert.equal(zero, 0)
})

test('una data nel futuro si riporta ad adesso', salta, () => {
  // Basta che il programma che riempie la tabella scriva l'ora locale e il
  // database la legga come UTC: due ore di scarto, e quel prezzo vincerebbe
  // su tutto per sempre, senza che si capisca perché non cambia mai.
  const domani = new Date(Date.now() + 86_400_000).toISOString().slice(0, 19).replace('T', ' ')
  const ieri = new Date(Date.now() - 86_400_000).toISOString().slice(0, 19).replace('T', ' ')
  const [nelFuturo, nelPassato] = chiamaPhp([
    { funzione: 'ragionevole', valore: domani },
    { funzione: 'ragionevole', valore: ieri },
  ])
  assert.ok(nelFuturo <= Date.now() + 2000, `una data di domani non deve restare nel futuro: ${new Date(nelFuturo).toISOString()}`)
  assert.ok(nelFuturo > Date.now() - 120_000, 'ma nemmeno azzerata: vale adesso')
  assert.ok(Math.abs(nelPassato - (Date.now() - 86_400_000)) < 7_200_000 + 60_000, 'una data passata resta com’è')
})
