# Il listino condiviso, su Aruba

Questa cartella è il servizio che tiene i prezzi in comune: lo carichi sul tuo
spazio web Aruba (quello con PHP e MySQL, il piano normale) e da quel momento
tutti quelli che usano l'app vedono gli stessi prezzi.

Tre file, nient'altro: nessuna libreria da installare, nessun `composer`,
niente da tenere acceso. Gira quando qualcuno lo chiama e sta zitto il resto
del tempo.

## Cosa fa e cosa non fa

- **Anche il catalogo delle carte è di tutti.** Senza sorgenti esterne
  l'elenco dei giocatori non lo regala nessuno: chi non trova una carta la
  crea scrivendone nome e valutazione, e da quel momento la trovano tutti. Due
  persone che creano lo stesso nome con la stessa valutazione ottengono la
  stessa carta, non due doppioni.
- **I prezzi sono di tutti.** Chi scrive un prezzo lo scrive per tutti, e
  accanto compare il suo nome. Fra due versioni della stessa carta vince
  quella vista più di recente — non «l'ultima arrivata», che premierebbe il
  telefono con l'orologio avanti.
- **La rosa è di ciascuno.** Rosa, watchlist e impostazioni restano legate al
  nome: le ritrovi identiche sul telefono e sul computer, e gli altri non le
  vedono.
- **Il nome non è una password.** Chi conosce l'indirizzo può scrivere, e
  scrivendo il tuo nome scriverebbe a nome tuo. È una scelta, presa per non
  dover gestire password e registrazioni: va bene fra persone che si
  conoscono, non va bene se l'indirizzo finisce in giro. Se un domani servisse
  di più, il punto da cambiare è uno solo (l'azione `entra` in `api.php`).

## Come metterlo online, in cinque passi

1. **Crea il database.** Pannello Aruba → *Gestione Hosting Linux* →
   *Database* → crea un database MySQL. Segnati i quattro dati che ti dà:
   host (qualcosa come `nomedb.mysql.web.aruba.it`, **non** `localhost`), nome
   del database, utente, password.

2. **Crea le tabelle.** Sempre dal pannello, apri *phpMyAdmin*, scegli il tuo
   database, scheda **SQL**, incolla tutto il contenuto di `schema.sql` e premi
   *Esegui*. Si può rilanciare senza far danni.

3. **Prepara la configurazione.** Copia `config.esempio.php` in `config.php` e
   scrivici i quattro dati del passo 1.

4. **Carica i file.** Via FTP (FileZilla va benissimo, i dati di accesso sono
   nel pannello) crea una cartella dentro lo spazio web — per esempio `fc27` —
   e copiaci dentro `api.php` e `config.php`. `schema.sql`, questo file e
   `config.esempio.php` non servono online: puoi caricarli o no.

5. **Prova che risponda.** Apri nel browser
   `https://iltuosito.it/fc27/api.php?azione=salute`: deve uscire una riga di
   testo tipo
   `{"ok":true,"servizio":"listino condiviso FC27 Trader",...}`.
   Se esce un errore sul database, è il passo 3 da rivedere.

Poi, nell'app: *Opzioni → Listino condiviso*, incolla quell'indirizzo, scrivi
il tuo nome e premi **Collegati**. Sugli altri dispositivi si fa lo stesso:
stesso indirizzo, e il proprio nome.

## Due avvertenze che fanno perdere tempo se non le sai

- **Serve HTTPS.** L'app pubblicata su GitHub Pages viaggia su `https://`, e
  un sito in `https` non può chiamare un indirizzo in `http`: il browser
  blocca la richiesta senza nemmeno provarci. Aruba dà un certificato gratuito
  (pannello → *Sicurezza* / *SSL*): attivalo prima di collegare l'app.
- **Il dominio è diverso da quello dell'app.** È normale, ed è già previsto:
  `api.php` manda le intestazioni CORS che servono. Quando l'indirizzo pubblico
  dell'app è definitivo, mettilo in `origini` dentro `config.php` al posto di
  `'*'`: da quel momento solo la tua app potrà chiamarlo.

## Se hai già caricato il servizio prima del catalogo condiviso

Sono state aggiunte due tabelle. Riapri phpMyAdmin, scheda **SQL**, e incolla
di nuovo tutto `schema.sql`: le tabelle che esistono già non vengono toccate
(`create table if not exists`), e le due nuove vengono create. Poi ricarica
`api.php` via FTP.

## Quando qualcosa non funziona

Apri `https://iltuosito.it/fc27/api.php?azione=diagnostica` (oppure premi
**Controlla il server** in *Opzioni → Listino condiviso*). Risponde con la
versione di PHP, quella del database, **quanti giocatori ci sono in archivio**
e **l'elenco delle tabelle mancanti**: se ne manca una, basta rieseguire
`schema.sql` da phpMyAdmin; se i giocatori sono molti meno delle carte del tuo
CSV, il catalogo va ricondiviso dall'app.

## Manutenzione

Praticamente nessuna. Il listino si pota da solo quando supera
`massimo_carte` (5000 di default, che sono molte più di quante ne servano).
Per un backup basta l'esportazione di phpMyAdmin; per ricominciare da capo,
`drop` delle tabelle e di nuovo `schema.sql`.

## Le chiamate, se ti servissero

| Chiamata | Cosa fa |
| --- | --- |
| `GET api.php?azione=salute` | stato del servizio e due conteggi |
| `POST api.php?azione=entra` | `{nome}` → restituisce il token del dispositivo |
| `GET api.php?azione=prezzi&piattaforma=ps&da=0` | il listino, o solo ciò che è cambiato dopo `da` |
| `POST api.php?azione=prezzi` | `{piattaforma, prezzi:[{id, price, at}]}` (serve il token) |
| `GET api.php?azione=diagnostica` | versioni e tabelle mancanti: la prima cosa da guardare se qualcosa non va |
| `GET api.php?azione=catalogo` | stato del catalogo condiviso (versione, blocchi, carte) |
| `GET api.php?azione=catalogo&blocco=0` | un blocco del catalogo |
| `POST api.php?azione=catalogo` | `{versione, indice, blocchi, totale, carte}` carica un blocco, e scrive le stesse carte in `giocatori` (serve il token) |
| `POST api.php?azione=unisci` | `{unioni:[{da,a}]}` due carte sono lo stesso giocatore: sposta prezzo e storico su `a` e cancella `da` (serve il token) |
| `GET api.php?azione=cerca&q=lautaro` | cerca nel catalogo comune delle carte |
| `POST api.php?azione=carta` | `{giocatore:{id,name,rating,…}}` aggiunge una carta al catalogo (serve il token) |
| `GET api.php?azione=storico&id=1001&piattaforma=ps` | un prezzo al giorno per quella carta |
| `GET/POST api.php?azione=dati` | i dati personali di chi ha il token |
| `GET api.php?azione=chi` | chi usa il listino e quanti prezzi ha scritto |

Il token va nell'intestazione `x-fc27-token`.
