// Archivio prezzi: il nostro database.
//
// Non inventa prezzi — quelli arrivano da una sorgente o li scrivi tu — ma
// risolve tre problemi concreti:
//
//   1. i piani a consumo: si interroga la sorgente una volta e il dato resta,
//      invece di richiederlo a ogni schermata;
//   2. lo storico: serve per i segnali «sotto la media della settimana» e
//      «vicino al minimo», e nessuna API gratuita lo regala;
//   3. i dispositivi: telefono e computer leggono lo stesso archivio, quindi
//      un prezzo scritto sul divano si ritrova sul computer.
//
// È un file JSON scritto in modo atomico: nessun database da installare,
// nessun servizio da pagare, e si può copiare o cancellare a mano.

import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { recordSnapshot } from '../shared/history.mjs'

const FILE = process.env.FUT_ARCHIVE_FILE ?? resolve(fileURLToPath(new URL('../dati/archivio.json', import.meta.url)))
const MAX_GIOCATORI = Number(process.env.FUT_ARCHIVE_MAX ?? 400)
const SALVA_DOPO_MS = 1500

const vuoto = () => ({ versione: 1, aggiornato: 0, giocatori: {}, prezzi: {}, storico: {}, interesse: [] })

let dati = carica()
let salvataggioProgrammato = null

function carica() {
  try {
    if (!existsSync(FILE)) return vuoto()
    const letto = JSON.parse(readFileSync(FILE, 'utf8'))
    return { ...vuoto(), ...letto }
  } catch {
    // Archivio illeggibile: si riparte da zero invece di bloccare tutto.
    return vuoto()
  }
}

/** Scrittura atomica: prima il file temporaneo, poi la sostituzione. */
function salvaSubito() {
  try {
    mkdirSync(dirname(FILE), { recursive: true })
    const temporaneo = `${FILE}.tmp`
    dati.aggiornato = Date.now()
    writeFileSync(temporaneo, JSON.stringify(dati))
    renameSync(temporaneo, FILE)
  } catch (error) {
    console.error(`[fc27-trader] archivio non salvato: ${error instanceof Error ? error.message : error}`)
  }
}

/** Le scritture si accorpano: un aggiornamento di venti carte è un file solo. */
function programmaSalvataggio() {
  if (salvataggioProgrammato) return
  salvataggioProgrammato = setTimeout(() => {
    salvataggioProgrammato = null
    salvaSubito()
  }, SALVA_DOPO_MS)
  salvataggioProgrammato.unref?.()
}

function potaSeTroppoGrande() {
  const chiavi = Object.keys(dati.prezzi)
  if (chiavi.length <= MAX_GIOCATORI) return
  // Si tengono le carte aggiornate più di recente.
  const ordinate = chiavi.sort((a, b) => (ultimoAggiornamento(b) ?? 0) - (ultimoAggiornamento(a) ?? 0))
  for (const chiave of ordinate.slice(MAX_GIOCATORI)) {
    delete dati.prezzi[chiave]
    delete dati.storico[chiave]
    delete dati.giocatori[chiave]
  }
}

function ultimoAggiornamento(id) {
  const perPiattaforma = dati.prezzi[id] ?? {}
  return Math.max(0, ...Object.values(perPiattaforma).map((voce) => voce?.at ?? 0))
}

export function ricordaGiocatore(player) {
  if (!player?.id) return
  dati.giocatori[player.id] = { ...dati.giocatori[player.id], ...player }
  programmaSalvataggio()
}

/**
 * Registra una quotazione. `origine` dice da dove viene: una sorgente
 * automatica, oppure la mano dell'utente.
 */
export function registraPrezzo(id, platform, quote, origine = 'sorgente') {
  const price = Math.round(Number(quote?.price) || 0)
  if (!id || !platform || price <= 0) return
  const chiave = String(id)
  dati.prezzi[chiave] = dati.prezzi[chiave] ?? {}
  dati.prezzi[chiave][platform] = {
    price,
    minPrice: Math.round(Number(quote.minPrice) || price),
    maxPrice: Math.round(Number(quote.maxPrice) || price),
    changePercent: Number(quote.changePercent) || 0,
    updated: String(quote.updated ?? ''),
    origine,
    at: Date.now(),
  }
  dati.storico[chiave] = dati.storico[chiave] ?? {}
  dati.storico[chiave][platform] = recordSnapshot(dati.storico[chiave][platform] ?? [], price)
  potaSeTroppoGrande()
  programmaSalvataggio()
}

export function leggiPrezzo(id, platform) {
  const voce = dati.prezzi[String(id)]?.[platform]
  if (!voce) return null
  return {
    price: voce.price,
    minPrice: voce.minPrice,
    maxPrice: voce.maxPrice,
    changePercent: voce.changePercent,
    updated: voce.origine === 'manuale' ? 'scritto da te, in archivio' : `archivio · ${voce.updated || 'senza data'}`,
    at: voce.at,
    origine: voce.origine,
  }
}

export function leggiStorico(id, platform) {
  return dati.storico[String(id)]?.[platform] ?? []
}

export function leggiGiocatore(id) {
  return dati.giocatori[String(id)] ?? null
}

/** L'elenco delle carte che interessano all'utente, da tenere aggiornate. */
export function impostaInteresse(ids) {
  const puliti = [...new Set((ids ?? []).map(String).filter(Boolean))].slice(0, MAX_GIOCATORI)
  dati.interesse = puliti
  programmaSalvataggio()
  return puliti
}

export function leggiInteresse() {
  return [...dati.interesse]
}

export function statistiche() {
  const carte = Object.keys(dati.prezzi).length
  const punti = Object.values(dati.storico).reduce(
    (totale, perPiattaforma) => totale + Object.values(perPiattaforma).reduce((somma, serie) => somma + serie.length, 0),
    0,
  )
  return { file: FILE, carte, puntiStorico: punti, interesse: dati.interesse.length, aggiornato: dati.aggiornato }
}

export function salvaOra() {
  if (salvataggioProgrammato) {
    clearTimeout(salvataggioProgrammato)
    salvataggioProgrammato = null
  }
  salvaSubito()
}
