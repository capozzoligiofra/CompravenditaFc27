-- Svuotare il listino: tutto, e ripartire da zero.
--
-- Da eseguire da phpMyAdmin (pannello Aruba → Database → Gestione →
-- phpMyAdmin → scheda SQL → incolla e premi Esegui). Le tabelle restano al
-- loro posto: si svuotano soltanto, quindi non serve rieseguire schema.sql
-- dopo.
--
-- ATTENZIONE: non si torna indietro. I prezzi, lo storico e il catalogo
-- condiviso sono gli stessi per tutto il gruppo, non solo tuoi. Se vuoi una
-- copia prima, da phpMyAdmin: scheda «Esporta» → Esegui, e ti scarichi un
-- file .sql con dentro tutto.
--
-- NON BASTA QUESTO. Ogni dispositivo tiene una copia locale di quello che ha
-- scaricato, e alla prima sincronizzazione la rimanda su: il listino si
-- ripopolerebbe da solo nel giro di un minuto. I passi da fare sull'app, su
-- OGNI dispositivo, sono scritti in fondo.

-- --- I giocatori e i loro prezzi ---------------------------------------

-- L'anagrafica delle carte: e' questa la tabella dei «giocatori».
truncate table giocatori;

-- L'ultimo prezzo di ogni carta, per piattaforma.
truncate table prezzi;

-- Lo storico: un prezzo al giorno per carta. Sparisce anche quello, e con
-- lui le stime, che si costruiscono proprio sui punti passati.
truncate table storico;

-- Il catalogo condiviso, quello caricato dal CSV: i blocchi e il segnaposto
-- che dice qual e' la versione buona.
truncate table catalogo;
truncate table catalogo_stato;

-- --- Le persone --------------------------------------------------------
--
-- Qui sotto spariscono anche gli account e i dati personali di tutti: rosa,
-- watchlist e impostazioni di ognuno. Se volevi buttare solo i giocatori e i
-- prezzi, FERMATI PRIMA DI QUESTE TRE RIGHE.
--
-- Cancellare le sessioni invalida i token salvati sui telefoni. L'app se ne
-- accorge e rientra da sola con il tuo nome, quindi non resta bloccata; ma
-- gli account vengono ricreati da capo, e chi aveva dati personali sul
-- server li ritrova solo se sono ancora sul suo dispositivo.

truncate table dati_utente;
truncate table sessioni;
truncate table utenti;

-- --- Dopo, sull'app, su ogni dispositivo -------------------------------
--
--   1. Opzioni → Listino condiviso → «Dimentica i prezzi scaricati»
--      (toglie la copia locale del listino; la tua rosa resta)
--   2. Opzioni → Dati locali → cancella i prezzi scritti a mano
--      (senza questo, la prima sincronizzazione li rimanda sul server)
--   3. Prezzi → Catalogo dei giocatori → «Svuota il catalogo»
--      (il catalogo locale non risale da solo, ma se lo lasci la ricerca
--       continua a trovare le carte su questo dispositivo)
--
-- Per controllare che sia andata: Opzioni → Listino condiviso →
-- «Controlla il server». Deve dire «0 giocatori in archivio».
