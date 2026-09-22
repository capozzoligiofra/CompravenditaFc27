// "npm run aggiorna": aggiorna l'archivio dei prezzi.
//
// Prende le carte che interessano (quelle che l'app ha dichiarato: watchlist,
// rosa, schede aperte) e ne richiede la quotazione alla sorgente, una alla
// volta e con le pause del rate limiter. Il risultato finisce nell'archivio,
// che è quello che l'app legge: così le richieste si fanno una volta al
// giorno invece che a ogni schermata, e lo storico cresce anche quando
// l'app è chiusa.
//
// Si può lanciare a mano, oppure lasciarlo fare al server con
// FUT_REFRESH_MINUTES (vedi README).

import * as archivio from '../server/archive.mjs'
import { fetchPrices, providerConfig } from '../server/providers.mjs'

const PIATTAFORME = (process.env.FUT_REFRESH_PLATFORMS ?? 'ps').split(',').map((voce) => voce.trim()).filter(Boolean)
const MAX = Number(process.env.FUT_REFRESH_MAX ?? 40)

export async function aggiornaArchivio({ silenzioso = false } = {}) {
  const parla = (testo) => {
    if (!silenzioso) console.log(testo)
  }

  const interesse = archivio.leggiInteresse().slice(0, MAX)
  if (interesse.length === 0) {
    parla('')
    parla("Nessuna carta da aggiornare: apri l'app almeno una volta, così dichiara")
    parla('quali giocatori segui (watchlist, rosa, schede aperte).')
    parla('')
    return { aggiornate: 0, falliti: 0, totale: 0 }
  }

  if (!providerConfig.enabled) {
    parla('')
    parla(`Sorgente ${providerConfig.name} non configurata: niente da aggiornare.`)
    parla("I prezzi scritti a mano restano nell'archivio e continuano a valere.")
    parla('')
    return { aggiornate: 0, falliti: 0, totale: interesse.length }
  }

  parla('')
  parla(`Aggiorno ${interesse.length} carte da ${providerConfig.label ?? providerConfig.name}…`)

  let aggiornate = 0
  let falliti = 0
  let primoErrore = null

  for (const id of interesse) {
    try {
      const prezzi = await fetchPrices(id)
      let scritto = false
      for (const piattaforma of PIATTAFORME) {
        const quote = prezzi?.[piattaforma]
        if (quote?.price > 0) {
          archivio.registraPrezzo(id, piattaforma, quote)
          scritto = true
        }
      }
      if (scritto) aggiornate += 1
      else falliti += 1
    } catch (error) {
      falliti += 1
      primoErrore = primoErrore ?? (error instanceof Error ? error.message : String(error))
      // Se la sorgente ha messo un limite, insistere peggiora le cose.
      if (/429|troppe richieste/i.test(primoErrore)) break
    }
  }

  archivio.salvaOra()
  const conti = archivio.statistiche()
  parla(`Fatte: ${aggiornate} aggiornate, ${falliti} senza prezzo.`)
  if (primoErrore) parla(`Primo errore: ${primoErrore}`)
  parla(`Archivio: ${conti.carte} carte, ${conti.puntiStorico} punti di storico.`)
  parla('')
  return { aggiornate, falliti, totale: interesse.length }
}

// Eseguito direttamente da riga di comando.
if (import.meta.url === `file://${process.argv[1]}`) {
  await aggiornaArchivio()
}
