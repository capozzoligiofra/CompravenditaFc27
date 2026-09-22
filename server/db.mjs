// Database vero: SQLite, integrato in Node (node:sqlite), nessuna dipendenza
// da installare e nessun servizio da pagare.
//
// Rispetto a un file JSON cambia ciò che si può chiedere: non solo «quanto
// costa questa carta», ma «quali fra tutte quelle che ho archiviato sono
// scese di più negli ultimi tre giorni». È una domanda da database, e senza
// database non si fa.
//
// Tabelle:
//   giocatori  anagrafica minima (nome, valutazione, lega, nazione…)
//   prezzi     ultima quotazione per carta e piattaforma
//   storico    un prezzo al giorno per carta e piattaforma
//   interesse  le carte che l'utente segue, da tenere aggiornate

import { mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'

// node:sqlite si carica con require perché su alcune versioni di Node è
// ancora contrassegnato come sperimentale e l'import statico fallirebbe.
const require = createRequire(import.meta.url)

const GIORNO = 86_400_000

export function apriDatabase(percorso) {
  const { DatabaseSync } = require('node:sqlite')
  mkdirSync(dirname(percorso), { recursive: true })
  const db = new DatabaseSync(percorso)

  // WAL: scritture veloci e lettura contemporanea, utile se il server scrive
  // mentre l'aggiornamento periodico gira.
  db.exec('pragma journal_mode = wal')
  db.exec(`
    create table if not exists giocatori (
      id text primary key,
      nome text,
      valutazione integer,
      ruolo text,
      club text,
      lega text,
      nazione text,
      versione text,
      aggiornato integer
    );
    create table if not exists prezzi (
      id text not null,
      piattaforma text not null,
      prezzo integer not null,
      minimo integer,
      massimo integer,
      variazione real,
      origine text,
      etichetta text,
      aggiornato integer not null,
      primary key (id, piattaforma)
    );
    create table if not exists storico (
      id text not null,
      piattaforma text not null,
      giorno integer not null,
      prezzo integer not null,
      aggiornato integer not null,
      primary key (id, piattaforma, giorno)
    );
    create table if not exists interesse (
      id text primary key,
      aggiunto integer not null
    );
    create index if not exists idx_storico_carta on storico (id, piattaforma, giorno);
    create index if not exists idx_prezzi_aggiornato on prezzi (aggiornato);
  `)
  return db
}

/** Il database è disponibile? Su Node vecchi node:sqlite può mancare. */
export function sqliteDisponibile() {
  try {
    require('node:sqlite')
    return true
  } catch {
    return false
  }
}

export function creaArchivioSqlite(percorsoFile) {
  const percorso = resolve(percorsoFile)
  const db = apriDatabase(percorso)

  const inserisciGiocatore = db.prepare(`
    insert into giocatori (id, nome, valutazione, ruolo, club, lega, nazione, versione, aggiornato)
    values (?, ?, ?, ?, ?, ?, ?, ?, ?)
    on conflict(id) do update set
      nome = excluded.nome,
      valutazione = excluded.valutazione,
      ruolo = excluded.ruolo,
      club = excluded.club,
      lega = excluded.lega,
      nazione = excluded.nazione,
      versione = excluded.versione,
      aggiornato = excluded.aggiornato
  `)
  const leggiGiocatoreStmt = db.prepare('select * from giocatori where id = ?')

  const inserisciPrezzo = db.prepare(`
    insert into prezzi (id, piattaforma, prezzo, minimo, massimo, variazione, origine, etichetta, aggiornato)
    values (?, ?, ?, ?, ?, ?, ?, ?, ?)
    on conflict(id, piattaforma) do update set
      prezzo = excluded.prezzo,
      minimo = excluded.minimo,
      massimo = excluded.massimo,
      variazione = excluded.variazione,
      origine = excluded.origine,
      etichetta = excluded.etichetta,
      aggiornato = excluded.aggiornato
  `)
  const leggiPrezzoStmt = db.prepare('select * from prezzi where id = ? and piattaforma = ?')

  const inserisciStorico = db.prepare(`
    insert into storico (id, piattaforma, giorno, prezzo, aggiornato)
    values (?, ?, ?, ?, ?)
    on conflict(id, piattaforma, giorno) do update set
      prezzo = excluded.prezzo,
      aggiornato = excluded.aggiornato
  `)
  const leggiStoricoStmt = db.prepare(
    'select giorno, prezzo from storico where id = ? and piattaforma = ? order by giorno asc limit 90',
  )

  const svuotaInteresse = db.prepare('delete from interesse')
  const inserisciInteresse = db.prepare('insert or replace into interesse (id, aggiunto) values (?, ?)')
  const leggiInteresseStmt = db.prepare('select id from interesse order by aggiunto asc')

  const contaCarte = db.prepare('select count(*) as n from prezzi')
  const contaStorico = db.prepare('select count(*) as n from storico')
  const contaInteresse = db.prepare('select count(*) as n from interesse')
  const ultimoAggiornamento = db.prepare('select max(aggiornato) as t from prezzi')

  /**
   * Le carte che si sono mosse di più: confronta il prezzo di oggi con quello
   * di N giorni fa. È la query che un file JSON non sa fare e che permette di
   * proporre occasioni fuori dalla watchlist.
   */
  const movimentiStmt = db.prepare(`
    with oggi as (
      select id, piattaforma, prezzo, giorno
      from storico s1
      where piattaforma = ?
        and giorno = (select max(giorno) from storico s2 where s2.id = s1.id and s2.piattaforma = s1.piattaforma)
    ),
    prima as (
      select id, piattaforma, prezzo, giorno
      from storico s1
      where piattaforma = ?
        and giorno = (
          select max(giorno) from storico s2
          where s2.id = s1.id and s2.piattaforma = s1.piattaforma and s2.giorno <= ?
        )
    )
    select oggi.id as id,
           g.nome as nome,
           g.valutazione as valutazione,
           g.lega as lega,
           g.nazione as nazione,
           oggi.prezzo as prezzo,
           prima.prezzo as prezzoPrima,
           round((oggi.prezzo - prima.prezzo) * 100.0 / prima.prezzo, 1) as variazione
    from oggi
    join prima on prima.id = oggi.id
    left join giocatori g on g.id = oggi.id
    where prima.prezzo > 0 and oggi.giorno > prima.giorno
    order by variazione asc
    limit ?
  `)

  const potaPrezzi = db.prepare(`
    delete from prezzi where id in (
      select id from prezzi order by aggiornato desc limit -1 offset ?
    )
  `)
  const potaStorico = db.prepare('delete from storico where id not in (select id from prezzi)')
  const potaGiocatori = db.prepare('delete from giocatori where id not in (select id from prezzi)')

  return {
    tipo: 'sqlite',
    percorso,

    ricordaGiocatore(player) {
      if (!player?.id) return
      inserisciGiocatore.run(
        String(player.id),
        String(player.name ?? ''),
        Number(player.rating ?? 0),
        String(player.position ?? ''),
        String(player.club ?? ''),
        String(player.league ?? ''),
        String(player.nation ?? ''),
        String(player.version ?? ''),
        Date.now(),
      )
    },

    registraPrezzo(id, piattaforma, quote, origine = 'sorgente', istante = Date.now()) {
      const prezzo = Math.round(Number(quote?.price) || 0)
      if (!id || !piattaforma || prezzo <= 0) return
      const adesso = istante
      inserisciPrezzo.run(
        String(id),
        String(piattaforma),
        prezzo,
        Math.round(Number(quote.minPrice) || prezzo),
        Math.round(Number(quote.maxPrice) || prezzo),
        Number(quote.changePercent) || 0,
        origine,
        String(quote.updated ?? ''),
        adesso,
      )
      inserisciStorico.run(String(id), String(piattaforma), Math.floor(adesso / GIORNO), prezzo, adesso)
    },

    leggiPrezzo(id, piattaforma) {
      const riga = leggiPrezzoStmt.get(String(id), String(piattaforma))
      if (!riga) return null
      return {
        price: riga.prezzo,
        minPrice: riga.minimo ?? riga.prezzo,
        maxPrice: riga.massimo ?? riga.prezzo,
        changePercent: riga.variazione ?? 0,
        updated:
          riga.origine === 'manuale' ? 'scritto da te, in archivio' : `archivio · ${riga.etichetta || 'senza data'}`,
        at: riga.aggiornato,
        origine: riga.origine,
      }
    },

    leggiStorico(id, piattaforma) {
      return leggiStoricoStmt
        .all(String(id), String(piattaforma))
        .map((riga) => ({ t: riga.giorno * GIORNO, price: riga.prezzo }))
    },

    leggiGiocatore(id) {
      const riga = leggiGiocatoreStmt.get(String(id))
      if (!riga) return null
      return {
        id: riga.id,
        name: riga.nome,
        rating: riga.valutazione,
        position: riga.ruolo,
        club: riga.club,
        league: riga.lega,
        nation: riga.nazione,
        version: riga.versione,
        image: '',
      }
    },

    impostaInteresse(ids) {
      const puliti = [...new Set((ids ?? []).map(String).filter(Boolean))].slice(0, 400)
      svuotaInteresse.run()
      const adesso = Date.now()
      for (const [indice, id] of puliti.entries()) inserisciInteresse.run(id, adesso + indice)
      return puliti
    },

    leggiInteresse() {
      return leggiInteresseStmt.all().map((riga) => riga.id)
    },

    /** Le carte più in calo (o in rialzo) fra quelle archiviate. */
    movimenti({ piattaforma = 'ps', giorni = 3, limite = 20, verso = 'calo' } = {}) {
      const confine = Math.floor(Date.now() / GIORNO) - Math.max(1, giorni)
      const righe = movimentiStmt.all(piattaforma, piattaforma, confine, Math.max(1, Math.min(100, limite * 2)))
      const ordinate = verso === 'rialzo' ? [...righe].reverse() : righe
      return ordinate.slice(0, limite)
    },

    pota(massimo = 400) {
      potaPrezzi.run(Math.max(1, massimo))
      potaStorico.run()
      potaGiocatori.run()
    },

    statistiche() {
      return {
        file: percorso,
        motore: 'sqlite',
        carte: contaCarte.get()?.n ?? 0,
        puntiStorico: contaStorico.get()?.n ?? 0,
        interesse: contaInteresse.get()?.n ?? 0,
        aggiornato: ultimoAggiornamento.get()?.t ?? 0,
      }
    },

    salvaOra() {
      // SQLite scrive subito: non c'è niente da svuotare.
    },

    chiudi() {
      db.close()
    },
  }
}
