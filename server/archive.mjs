// Sceglie dove tenere l'archivio.
//
// Di norma SQLite (node:sqlite, integrato in Node): è un database vero, con
// indici e query, e permette domande che un file non regge — per esempio
// «quali carte sono scese di più negli ultimi tre giorni» su tutto ciò che
// abbiamo raccolto. Se Node è troppo vecchio per node:sqlite, o se si
// preferisce un file leggibile a occhio, si ricade sul JSON: stessa
// interfaccia, meno possibilità.

import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { creaArchivioJson } from './archive-json.mjs'
import { creaArchivioSqlite, sqliteDisponibile } from './db.mjs'

const CARTELLA = resolve(fileURLToPath(new URL('../dati', import.meta.url)))
const MOTORE = String(process.env.FUT_DB_DRIVER ?? '').toLowerCase()

function scegli() {
  const vuoleJson = MOTORE === 'json'
  if (!vuoleJson && sqliteDisponibile()) {
    try {
      return creaArchivioSqlite(process.env.FUT_ARCHIVE_FILE ?? `${CARTELLA}/archivio.sqlite`)
    } catch (error) {
      console.error(
        `[fc27-trader] SQLite non utilizzabile (${error instanceof Error ? error.message : error}), uso il file JSON.`,
      )
    }
  }
  return creaArchivioJson(process.env.FUT_ARCHIVE_FILE ?? `${CARTELLA}/archivio.json`)
}

const archivio = scegli()

export const ricordaGiocatore = (...args) => archivio.ricordaGiocatore(...args)
export const registraPrezzo = (...args) => archivio.registraPrezzo(...args)
export const leggiPrezzo = (...args) => archivio.leggiPrezzo(...args)
export const leggiStorico = (...args) => archivio.leggiStorico(...args)
export const leggiGiocatore = (...args) => archivio.leggiGiocatore(...args)
export const impostaInteresse = (...args) => archivio.impostaInteresse(...args)
export const leggiInteresse = (...args) => archivio.leggiInteresse(...args)
export const movimenti = (...args) => archivio.movimenti(...args)
export const statistiche = (...args) => archivio.statistiche(...args)
export const salvaOra = (...args) => archivio.salvaOra(...args)
export const motore = archivio.tipo
