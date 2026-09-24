// Stima del prezzo fra un'osservazione e l'altra.
//
// Tu segni un prezzo ogni tanto; il mercato invece si muove tutti i giorni.
// Qui si tiene insieme quello che sappiamo — l'ultimo prezzo visto, come si
// stava muovendo, e in che fase della settimana siamo — per dire quanto
// dovrebbe costare adesso e quando conviene muoversi.
//
// Due regole di condotta, perché una stima non è un prezzo:
//   1. non si estrapola all'infinito: più è vecchia l'osservazione, meno la
//      stima si allontana da essa, e l'affidabilità scende;
//   2. la stima è sempre etichettata come tale e mostra da cosa nasce, così
//      si può non crederci.

import { CALENDARIO_PREDEFINITO, currentPhase } from './calendar.mjs'

const GIORNO = 86_400_000

/**
 * Quanto vale una carta in ciascuna fase, rispetto alla sua media.
 * Sono i valori di partenza, ricavati dal ciclo settimanale di Ultimate Team:
 * i premi e la vigilia della promo riempiono il mercato e fanno scendere i
 * prezzi, l'uscita della promo e la Weekend League li tirano su.
 */
export const FATTORI_BASE = {
  'crollo-premi': 0.95,
  'pre-promo': 0.93,
  'hype-promo': 1.06,
  'weekend-league': 1.03,
  notte: 0.98,
  'mid-settimana': 1.0,
}

/** Servono almeno tre osservazioni in una fase per fidarsi dei tuoi dati. */
const MIN_OSSERVAZIONI_FASE = 3
const MAX_SCOSTAMENTO = 0.25
const MAX_TREND_GIORNALIERO = 0.08

function media(valori) {
  if (valori.length === 0) return 0
  return valori.reduce((totale, valore) => totale + valore, 0) / valori.length
}

/**
 * Impara dai tuoi prezzi quanto vale ogni fase per questa carta. Finché i dati
 * non bastano restituisce i fattori di partenza: meglio un modello generale
 * che uno inventato su due punti.
 */
export function profiloDaStorico(history = [], calendario = CALENDARIO_PREDEFINITO) {
  const punti = history.filter((punto) => punto?.price > 0)
  if (punti.length < 6) return { fattori: { ...FATTORI_BASE }, imparato: false, osservazioni: punti.length }

  const mediaGenerale = media(punti.map((punto) => punto.price))
  if (mediaGenerale <= 0) return { fattori: { ...FATTORI_BASE }, imparato: false, osservazioni: punti.length }

  const perFase = new Map()
  for (const punto of punti) {
    const fase = currentPhase(new Date(punto.t), calendario).id
    const elenco = perFase.get(fase) ?? []
    elenco.push(punto.price / mediaGenerale)
    perFase.set(fase, elenco)
  }

  const fattori = { ...FATTORI_BASE }
  let imparato = false
  for (const [fase, rapporti] of perFase) {
    if (rapporti.length < MIN_OSSERVAZIONI_FASE) continue
    // Si mescola con il valore di partenza: i tuoi dati pesano, non decidono
    // da soli finché sono pochi.
    const peso = Math.min(1, rapporti.length / 8)
    fattori[fase] = FATTORI_BASE[fase] * (1 - peso) + media(rapporti) * peso
    imparato = true
  }
  return { fattori, imparato, osservazioni: punti.length }
}

/** Variazione giornaliera recente, in frazione (0,02 = +2% al giorno). */
export function tendenzaGiornaliera(history = []) {
  const punti = history.filter((punto) => punto?.price > 0).slice(-14)
  if (punti.length < 3) return 0
  const primo = punti[0]
  const ultimo = punti.at(-1)
  const giorni = Math.max(1, (ultimo.t - primo.t) / GIORNO)
  if (primo.price <= 0) return 0
  const variazione = (ultimo.price - primo.price) / primo.price / giorni
  return Math.max(-MAX_TREND_GIORNALIERO, Math.min(MAX_TREND_GIORNALIERO, variazione))
}

/**
 * Prezzo stimato adesso, partendo dall'ultima osservazione.
 *
 * @returns { price, confidenza, spiegazione, basePrice, baseAt, giorniPassati }
 */
export function stimaPrezzo({ history = [], quote = null, now = Date.now(), calendario = CALENDARIO_PREDEFINITO } = {}) {
  const punti = history.filter((punto) => punto?.price > 0).sort((a, b) => a.t - b.t)
  const osservazione = quote?.price > 0 ? { t: quote.at ?? now, price: quote.price } : punti.at(-1)

  if (!osservazione) {
    return { price: 0, confidenza: 'nessuna', spiegazione: 'Nessun prezzo osservato', basePrice: 0, baseAt: 0, giorniPassati: 0 }
  }

  const giorniPassati = Math.max(0, (now - osservazione.t) / GIORNO)
  const { fattori, imparato } = profiloDaStorico(punti, calendario)
  const faseAdesso = currentPhase(new Date(now), calendario)
  const faseAllora = currentPhase(new Date(osservazione.t), calendario)
  const fattoreAdesso = fattori[faseAdesso.id] ?? 1
  const fattoreAllora = fattori[faseAllora.id] ?? 1

  // Il ciclo settimanale vale subito; la tendenza si smorza col passare dei
  // giorni, perché estrapolare una settimana avanti è fantasia.
  const smorzamento = 1 / (1 + giorniPassati / 3)
  const tendenza = tendenzaGiornaliera(punti) * giorniPassati * smorzamento
  const scostamento = Math.max(
    -MAX_SCOSTAMENTO,
    Math.min(MAX_SCOSTAMENTO, fattoreAdesso / fattoreAllora - 1 + tendenza),
  )

  const price = Math.max(150, Math.round(osservazione.price * (1 + scostamento)))
  const confidenza = scegliConfidenza({ giorniPassati, punti: punti.length, imparato })

  const pezzi = []
  if (Math.abs(fattoreAdesso / fattoreAllora - 1) > 0.01) {
    pezzi.push(`${faseAdesso.label.toLowerCase()} rispetto a quando l'hai segnato`)
  }
  if (Math.abs(tendenza) > 0.01) pezzi.push(tendenza > 0 ? 'tendenza in salita' : 'tendenza in discesa')
  if (pezzi.length === 0) pezzi.push('nessun movimento atteso rispetto al prezzo che hai segnato')

  return {
    price,
    confidenza,
    spiegazione: pezzi.join(', '),
    basePrice: osservazione.price,
    baseAt: osservazione.t,
    giorniPassati,
    imparato,
  }
}

function scegliConfidenza({ giorniPassati, punti, imparato }) {
  if (giorniPassati <= 0.5 && punti >= 5) return 'alta'
  if (giorniPassati <= 3 && (punti >= 4 || imparato)) return 'media'
  if (giorniPassati <= 7) return 'bassa'
  return 'molto bassa'
}

/**
 * I momenti migliori dei prossimi giorni per comprare e per vendere, secondo
 * il ciclo settimanale e i fattori imparati dai tuoi prezzi.
 */
export function finestre({ history = [], now = Date.now(), giorni = 7, calendario = CALENDARIO_PREDEFINITO } = {}) {
  const { fattori } = profiloDaStorico(history, calendario)
  const faseAdesso = currentPhase(new Date(now), calendario)
  const fattoreAdesso = fattori[faseAdesso.id] ?? 1

  let minima = null
  let massima = null
  const passo = 2 * 3_600_000

  for (let istante = now + passo; istante <= now + giorni * GIORNO; istante += passo) {
    const fase = currentPhase(new Date(istante), calendario)
    const fattore = fattori[fase.id] ?? 1
    if (!minima || fattore < minima.fattore) minima = { istante, fase, fattore }
    if (!massima || fattore > massima.fattore) massima = { istante, fase, fattore }
  }

  const differenza = (fattore) => Math.round((fattore / fattoreAdesso - 1) * 1000) / 10

  return {
    adesso: { fase: faseAdesso, fattore: fattoreAdesso },
    acquisto: minima ? { quando: minima.istante, fase: minima.fase, variazioneAttesa: differenza(minima.fattore) } : null,
    vendita: massima ? { quando: massima.istante, fase: massima.fase, variazioneAttesa: differenza(massima.fattore) } : null,
  }
}
