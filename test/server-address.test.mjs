// L'indirizzo del listino, comunque lo si scriva.

import assert from 'node:assert/strict'
import { test } from 'node:test'

import { normalizzaServer } from '../shared/server-address.mjs'

test('il caso semplice: il sito, e ci si mette api.php', () => {
  assert.equal(normalizzaServer('www.edpservice.it/fc27'), 'https://www.edpservice.it/fc27/api.php')
  assert.equal(normalizzaServer('https://www.edpservice.it/fc27'), 'https://www.edpservice.it/fc27/api.php')
  assert.equal(normalizzaServer('https://www.edpservice.it/fc27/'), 'https://www.edpservice.it/fc27/api.php')
})

test('se api.php c’è già, non se ne aggiunge un altro', () => {
  assert.equal(normalizzaServer('https://www.edpservice.it/fc27/api.php'), 'https://www.edpservice.it/fc27/api.php')
})

test('l’indirizzo copiato dalla barra dopo una prova perde la domanda', () => {
  // È il modo naturale di prenderlo: si prova «?azione=salute» nel browser e
  // si copia. Senza questo taglio diventava «api.php?azione=salute/api.php»,
  // e ogni richiesta finiva altrove.
  assert.equal(
    normalizzaServer('https://www.edpservice.it/fc27/api.php?azione=salute'),
    'https://www.edpservice.it/fc27/api.php',
  )
  assert.equal(
    normalizzaServer('https://www.edpservice.it/fc27/api.php?azione=sorgente&cosa=stato'),
    'https://www.edpservice.it/fc27/api.php',
  )
  assert.equal(normalizzaServer('https://www.edpservice.it/fc27/?x=1'), 'https://www.edpservice.it/fc27/api.php')
})

test('spazi, http e vuoto', () => {
  assert.equal(normalizzaServer('  https://tuosito.it/fc27  '), 'https://tuosito.it/fc27/api.php')
  assert.equal(normalizzaServer('http://192.168.1.10/fc27'), 'http://192.168.1.10/fc27/api.php')
  assert.equal(normalizzaServer(''), '')
  assert.equal(normalizzaServer('   '), '')
})
