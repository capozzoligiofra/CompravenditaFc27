-- Le tabelle del listino condiviso.
--
-- Da eseguire una volta sola, dal phpMyAdmin che Aruba mette a disposizione
-- nel pannello (Database → Gestione → phpMyAdmin → scheda SQL → incolla e
-- premi Esegui). Se lo rilanci non rompe niente: usa "if not exists".

create table if not exists utenti (
  id            int unsigned not null auto_increment,
  nome          varchar(40) not null,
  nome_norm     varchar(40) not null,
  creato        bigint not null,
  visto         bigint not null,
  primary key (id),
  unique key uq_utenti_nome (nome_norm)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

-- Un dispositivo collegato. Lo stesso nome può avere più dispositivi: il
-- token dice solo «questo telefono è già entrato», non è una password.
create table if not exists sessioni (
  token    char(32) not null,
  utente   int unsigned not null,
  creato   bigint not null,
  visto    bigint not null,
  primary key (token),
  key idx_sessioni_utente (utente)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

create table if not exists giocatori (
  id           varchar(32) not null,
  nome         varchar(120) not null default '',
  valutazione  smallint not null default 0,
  ruolo        varchar(12) not null default '',
  club         varchar(80) not null default '',
  lega         varchar(80) not null default '',
  nazione      varchar(80) not null default '',
  versione     varchar(60) not null default '',
  aggiornato   bigint not null,
  primary key (id)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

-- Il listino vero e proprio: un prezzo per carta e piattaforma.
--   osservato  quando il prezzo è stato visto in gioco (orologio di chi scrive)
--   aggiornato quando il server l'ha registrato (serve per chiedere «cosa è
--              cambiato da quando ti ho sentito l'ultima volta»)
create table if not exists prezzi (
  id           varchar(32) not null,
  piattaforma  varchar(8) not null,
  prezzo       int unsigned not null,
  osservato    bigint not null,
  aggiornato   bigint not null,
  autore       int unsigned null,
  primary key (id, piattaforma),
  key idx_prezzi_aggiornato (piattaforma, aggiornato)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

-- Un prezzo al giorno per carta: è lo storico da cui nascono stime e segnali.
create table if not exists storico (
  id           varchar(32) not null,
  piattaforma  varchar(8) not null,
  giorno       int not null,
  prezzo       int unsigned not null,
  primary key (id, piattaforma, giorno)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

-- I dati personali di ciascuno (rosa, watchlist, impostazioni), così li
-- ritrovi uguali su telefono e computer. Restano di chi li scrive: il listino
-- è in comune, questi no.
create table if not exists dati_utente (
  utente      int unsigned not null,
  contenuto   longtext not null,
  aggiornato  bigint not null,
  primary key (utente)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

-- Il catalogo condiviso: l'elenco dei giocatori caricato una volta da un
-- dispositivo e scaricato da tutti gli altri. Viaggia a blocchi perché un
-- elenco da ventimila carte non sta in una richiesta sola.
create table if not exists catalogo (
  versione    bigint not null,
  indice      int not null,
  contenuto   longtext not null,
  aggiornato  bigint not null,
  primary key (versione, indice)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;

-- Qual è il catalogo buono, adesso: si aggiorna solo quando tutti i blocchi
-- sono arrivati, così nessuno scarica una versione a metà.
create table if not exists catalogo_stato (
  id          tinyint unsigned not null,
  versione    bigint not null,
  blocchi     int not null,
  carte       int not null,
  aggiornato  bigint not null,
  primary key (id)
) engine=InnoDB default charset=utf8mb4 collate=utf8mb4_unicode_ci;
