# FC27 Trader

Assistente per la compravendita di carte su EA FC 27 Ultimate Team: cerca un
giocatore, legge il prezzo di mercato da **Futbin**, e calcola i numeri che
servono davvero per guadagnarci — prezzo massimo di acquisto, prezzo di
rivendita, profitto al netto della tassa EA del 5%.

Non automatizza nulla dentro il gioco e non tocca il tuo account EA: è uno
strumento di analisi e di contabilità personale.

## Cosa fa

- **Occasioni** — la schermata iniziale: proposte di acquisto ordinate per
  convenienza, con il motivo di ognuna, il prezzo massimo a cui comprarle e
  quello verso cui rivenderle. Sopra, il momento del ciclo settimanale e il
  conto alla rovescia per i prossimi eventi che muovono i prezzi.
- **Avvisi** — la campanella in alto: target raggiunti, carte in magazzino
  andate in utile, finestre di acquisto che si aprono. Con notifica del
  browser, se la attivi.
- **Mercato** — ricerca giocatori, prezzo attuale, minimo/massimo, variazione,
  grafico dello storico e «piano di trade» già pronto: a quanto comprare per
  ottenere il margine che hai impostato e a quanto rivendere.
- **Watchlist** — i giocatori che segui con target di acquisto e di vendita.
  Ogni riga mostra il segnale: *compra ora*, *vendi ora* o *attendi*.
- **Calcolatore** — margine su un singolo trade (tassa, incasso netto, ROI,
  prezzo di pareggio) e il BIN massimo da mettere nel filtro quando cerchi
  occasioni, anche in tabella per margini dal 5% al 50%.
- **Conti** — la tua rosa e il registro degli acquisti: importazione della
  rosa incollando l'elenco, verdetto «tieni o vendi» su ogni carta con il
  motivo, capitale investito, profitto già incassato, profitto latente ai
  prezzi correnti, percentuale di trade in utile ed esportazione CSV.
- **Impostazioni** — piattaforma, tassa, margine obiettivo, budget, backup
  JSON dei dati e diagnostica della connessione a Futbin.

Watchlist, portafoglio e impostazioni vivono in `localStorage`: nessun
account, nessun server, nessun costo.

## Avvio

```bash
npm install
npm run dev      # proxy dati (porta 8787) + interfaccia (porta 5173)
```

Poi apri <http://localhost:5173>.

Per la versione di produzione:

```bash
npm run build    # compila l'interfaccia in dist/
npm run server   # un solo processo serve API e interfaccia su :8787
npm run mobile   # come sopra, ma raggiungibile dal telefono sulla stessa Wi-Fi
```

## Dal telefono

L'app è installabile: una volta aperta nel browser del telefono, dal menu
scegli **«Aggiungi a schermata Home»** (Android: ⋮ → Installa app; iPhone:
Condividi → Aggiungi a Home). Da quel momento ha la sua icona, si apre a
schermo intero e resta utilizzabile anche senza rete.

### 1. Sulla stessa rete Wi-Fi di casa (consigliato)

È l'unico modo che dà i **prezzi veri**, perché le richieste a Futbin partono
dalla connessione di casa e non da un datacenter.

```bash
npm run mobile
```

Il comando compila l'app e la pubblica sulla rete locale, stampando gli
indirizzi da digitare sul telefono, per esempio:

```
  Dal telefono (stessa rete Wi-Fi) apri:
    http://192.168.1.42:8787
```

Il computer deve restare acceso con il comando in esecuzione, e telefono e
computer devono essere sulla stessa Wi-Fi. In questa modalità il server
risponde a chiunque sia sulla tua rete e non ha password: tienilo per la rete
di casa, non su Wi-Fi pubbliche.

### 2. GitHub Pages: l'app online, senza prezzi live

Il repository pubblica da solo la versione statica su GitHub Pages a ogni push
su `main` (workflow `.github/workflows/pages.yml`). L'indirizzo è:

```
https://capozzoligiofra.github.io/CompravenditaFc27/
```

> **Da impostare una volta sola.** In *Settings → Pages → Build and
> deployment → Source* dev'esserci **GitHub Actions**, non «Deploy from a
> branch». Con l'impostazione a branch, GitHub pubblica i file sorgenti del
> repository invece della build: il browser riceve un `index.html` che punta
> a `/src/main.tsx`, che nessun browser sa eseguire, e mostra una **pagina
> bianca**. Si riconosce dal fatto che a ogni push girano due processi,
> «Pubblica su GitHub Pages» e «pages build and deployment»: il secondo
> finisce dopo e sovrascrive il lavoro del primo. Cambiata l'impostazione, il
> secondo sparisce da solo.

Da lì l'app si apre ovunque e si installa sul telefono come le altre versioni.
Il limite è strutturale, non un dettaglio: **Pages serve solo file statici**,
quindi non può ospitare il proxy e non esistono prezzi live. L'app se ne
accorge da sola, mostra il badge `DATI DEMO` e lavora con il dataset demo che
si porta dietro. Restano pienamente funzionanti calcolatore, watchlist,
portafoglio e tutti i conti, perché avvengono nel telefono.

Se hai un proxy raggiungibile in https (per esempio un tunnel verso il tuo
computer), puoi indicarne l'indirizzo in **Opzioni → Indirizzo del proxy dati**
e anche la versione su Pages mostrerà i prezzi veri. Un indirizzo `http://…`
non funziona: il browser blocca le chiamate non cifrate da una pagina https.

#### Con un dominio tuo

Il sito su Pages può stare su un indirizzo tuo, per esempio
`https://fc27trader.it`, restando gratuito: si paga solo il dominio (dieci o
quindici euro l'anno da un qualsiasi registrar).

1. **Dichiara il dominio nel progetto.** Crea il file `public/CNAME` con
   dentro solo il dominio, senza `https://`:

   ```
   fc27trader.it
   ```

   Al primo push il workflow se ne accorge da solo e compila il sito per la
   radice del dominio invece che per la sottocartella `/CompravenditaFc27/`.

2. **Punta il dominio a GitHub.** Nel pannello DNS del registrar:

   | Tipo | Nome | Valore |
   | --- | --- | --- |
   | A | `@` | `185.199.108.153` |
   | A | `@` | `185.199.109.153` |
   | A | `@` | `185.199.110.153` |
   | A | `@` | `185.199.111.153` |
   | CNAME | `www` | `capozzoligiofra.github.io` |

   I quattro record A servono per il dominio nudo (`fc27trader.it`), che per
   le regole del DNS non può essere un CNAME; il CNAME serve solo per
   `www.fc27trader.it`.

3. **Dillo a GitHub.** Repository → *Settings* → *Pages* → *Custom domain*:
   scrivi il dominio e salva. Quando il certificato è pronto (di solito
   qualche minuto, fino a 24 ore) spunta **Enforce HTTPS**.

Il DNS può metterci fino a un giorno a propagarsi: se nel frattempo il sito
non risponde o il browser segnala il certificato, quasi sempre basta
aspettare. Chi aveva già installato l'app sul telefono dal vecchio indirizzo
deve reinstallarla dal nuovo: per il telefono sono due siti diversi, e i dati
salvati (watchlist, rosa) restano legati al vecchio.

Un dominio però non cambia la sostanza: **Pages resta un hosting statico**, e
lì i prezzi restano quelli demo. Se vuoi prezzi veri su un indirizzo pubblico
serve un hosting con funzioni lato server (la strada 3 qui sotto), tenendo
presente che Futbin filtra comunque il traffico dei datacenter.

### 3. Online con i prezzi, su un hosting con funzioni

Il repo è già configurato anche per un deploy su Vercel (piano gratuito): il proxy
diventa una funzione serverless (`api/`) e l'interfaccia viene servita come
sito statico. Basta collegare il repository su <https://vercel.com/new>,
lasciare le impostazioni proposte e fare Deploy: ottieni un indirizzo
`https://…vercel.app` apribile ovunque, anche in 4G.

Una avvertenza onesta: Futbin filtra il traffico proveniente dai datacenter,
quindi è probabile che dall'hosting le richieste vengano respinte e l'app
mostri il badge `DATI DEMO`. Calcolatore, watchlist e portafoglio funzionano
comunque al 100% (i conti sono locali); per i prezzi aggiornati serve la
modalità Wi-Fi qui sopra. L'indirizzo pubblico è raggiungibile da chiunque lo
conosca, ma i tuoi dati restano sul tuo telefono: sul server non viene salvato
nulla.

### Cosa funziona senza rete

Watchlist, portafoglio e calcolatore vivono nel telefono, quindi funzionano
sempre. I prezzi invece no: l'app mostra l'ultima risposta ricevuta e la
segnala con l'etichetta **OFFLINE** e la scritta «prezzi salvati in memoria,
non aggiornati», così non rischi di comprare guardando un prezzo di ieri.

## Come sceglie i giocatori da comprare

Il mercato di Ultimate Team non si muove a caso: si muove sul **calendario**
dei contenuti e sulla **domanda improvvisa** creata da sfide e obiettivi.
L'app mette insieme tre cose.

### 1. Il ciclo settimanale

È la causa più regolare dei movimenti di prezzo. Quando arrivano i premi tutti
aprono pacchetti, il mercato si riempie di carte e i prezzi scendono; quando si
gioca si ricompra e i prezzi risalgono. Orari italiani:

| Quando | Cosa succede | Effetto |
| --- | --- | --- |
| Giovedì mattina | Chiude la Champions, arrivano i premi | Offerta ↑, prezzi ↓ — **si compra** |
| Giovedì sera → venerdì | Si svende la rosa per fare crediti in vista della promo | Prezzi ai minimi — **si compra** |
| Venerdì 19:00 | Nuova promo e apertura Champions | Domanda ↑ — **si vende** |
| Sabato e domenica | Weekend League in corso | Domanda alta, prezzi tengono |
| Lunedì mattina | Premi Rivals | Seconda ondata di pacchetti, prezzi ↓ |
| Notte e primo mattino | Pochi acquirenti online | Occasioni sotto prezzo |

L'app riconosce da sola in che fase sei e te lo dice in cima alla pagina
Occasioni, con il conto alla rovescia per il prossimo appuntamento.

### 2. I catalizzatori

Sono gli eventi che creano domanda su carte precise:

- **Sfide creazione rosa (SBC)**: chiedono giocatori di una lega, di una
  nazione o sopra una certa valutazione. È il motivo per cui il "fodder" 83-86
  è sempre conteso.
- **Obiettivi**: premiano chi segna o gioca con giocatori di una nazionalità o
  di un campionato, e quei giocatori diventano improvvisamente richiesti.
- **Promo**: mettono sotto i riflettori un campionato o una nazione.
- **Prima settimana di Weekend League e lancio del gioco**: le carte meta e i
  difensori usati da tutti salgono per primi.

L'app prova a leggerli da Futbin (pagine SBC e obiettivi) e ne ricava il
requisito dal titolo: «Serie A 84+ Upgrade» diventa *lega Serie A, valutazione
minima 84*. Quando Futbin non è raggiungibile o cambia pagina, l'elenco resta
vuoto e **li aggiungi tu** in dieci secondi dalla pagina Occasioni: titolo,
valutazione minima, lega, nazione. Un catalizzatore inserito a mano pesa come
uno letto da Futbin, e riconosce anche i nomi in inglese (una SBC "Italy" trova
i giocatori italiani).

### 3. I segnali di prezzo

Su ogni carta l'app guarda: quanto costa rispetto alla **media della
settimana**, quanto è vicina al **minimo** del periodo, come si è mossa negli
**ultimi tre giorni** e nelle **ultime ore**, e se è nella **fascia fodder**.

Da tutto questo esce un punteggio 0-100 con le ragioni in chiaro, e un
consiglio. Per dire «compra ora» non basta il punteggio alto: serve un motivo
concreto (prezzo sotto la media, una SBC che la richiede, un calo appena
avvenuto) **e** uno storico su cui basarsi. Senza, resta «tieni pronto». Se
ogni carta fosse un affare, il consiglio non varrebbe niente.

Le proposte nascono dai giocatori che segui: watchlist, carte in magazzino e
schede che hai aperto nel Mercato. Più usi l'app, più il bacino è tuo.

### Gli avvisi

Le regole che generano un avviso:

- un giocatore della watchlist scende sotto il tuo target di acquisto (o sale
  sopra quello di vendita);
- una carta in magazzino ha raggiunto il margine che hai impostato;
- compare un'occasione con punteggio alto che non stai già seguendo;
- si apre una finestra del calendario, o manca meno di tre ore a un evento.

Lo stesso avviso non si ripete finché la situazione non cambia davvero. Le
notifiche del browser sono facoltative e, non essendoci un server che le
spinge, arrivano solo mentre l'app è aperta (anche in secondo piano).

### Quello che l'app non fa

Non prevede il futuro e non conosce le notizie: un infortunio, un
annuncio a sorpresa o una carta speciale fuori calendario non li vede. Non
automatizza nulla in gioco. I prezzi di rivendita sono stime calcolate sui
segnali descritti qui sopra, e sono mostrati come tali.

Fonti usate per il modello del mercato:
[FUTBIN](https://www.futbin.com/),
[guida al mercato FC 26](https://www.itemd2r.com/en/blog/fc-26/ea-sports-fc-26-market-trds-trading-guide-for-smart-investors),
[trading settimana di lancio FC 27](https://timesaver.gg/blog/fc-27-fut-market-launch-week-trading-85s-otw-prep),
[calendario promo](https://www.dexerto.com/wikis/ea-fc-26-guides-walkthrough-tips/ea-fc-26-promo-calendar/),
[orari e premi della Champions](https://www.operationsports.com/ea-fc-26-champions-schedule-and-all-rewards/).

## Collegare l'account EA: cosa si può fare davvero

La domanda naturale è: perché non collego il mio account EA e lascio che
l'app legga la rosa da sola? Ecco la situazione, senza giri di parole.

**Non esiste un'API pubblica di Ultimate Team.** Con FC 26 EA ha aperto la
*FC Community API*, che permette di collegare l'account EA a un sito e
condividere i dati del proprio club, ma è riservata a pochi partner
autorizzati: al lancio soltanto **FUT.GG, FUTBIN e FUTWIZ**. EA avverte
esplicitamente di non fidarsi di nessun altro sito che mostri un login EA.
Un'app personale come questa non può ottenere quell'accesso.

**La strada non ufficiale è pericolosa, non scomoda.** Gli endpoint interni
della Web App (quelli che usano i vari tool "FUT") funzionano con il token di
sessione dell'account, ma sono esattamente ciò che EA punisce: nei giorni
prima dell'uscita di FC 27 ci sono stati ban di massa proprio per **strumenti
di terze parti che girano accanto alla Web App**, e il ban è permanente e
vale per tutti i titoli EA Sports FC presenti e futuri. Per questo l'app non
chiede le tue credenziali EA e non parlerà mai con i server EA: il rischio non
è un fastidio tecnico, è perdere il club.

**Quello che puoi fare, invece:**

1. Se vuoi la sincronizzazione ufficiale della rosa, collega il tuo account EA
   a **Futbin** (è uno dei partner autorizzati) dalla loro pagina: il login
   resta fra te ed EA, e nessuna password passa da terzi.
2. Porta la rosa qui **incollandola**: pagina *Conti* → «Importa la rosa». Una
   carta per riga, con quantità e prezzo pagato facoltativi:

   ```
   Lautaro Martinez x2 150k
   Bastoni 44000
   Rafael Leao, 1, 58000
   Declan Rice 55.000
   ```

   L'app cerca ogni nome sulla sorgente dati e collega la carta al suo prezzo,
   anche se scrivi i nomi senza accenti. Quello che non trova lo registra lo
   stesso, ma senza quotazione.

Da lì in poi la rosa è sotto osservazione: per ogni carta l'app dice se
**tenere o vendere**, guardando il guadagno rispetto a quanto l'hai pagata, la
posizione del prezzo rispetto ai massimi del periodo, le SBC che la richiedono
in quel momento e la fase della settimana. Quando scatta un «vendi ora» arriva
l'avviso.

## Quando i prezzi automatici non arrivano

Futbin protegge il sito dalle richieste automatiche: a un programma risponde
spesso **403**, anche da una normale connessione di casa. È il motivo per cui
l'app può mostrare `DATI DEMO` pur essendo tutto configurato bene. Travestire
l'app da browser per aggirare il blocco non è una strada che vale la pena
prendere: è un controllo di accesso, e violarlo mette a rischio te e il
servizio.

Quello che si fa invece:

- **Scrivere il prezzo a mano.** Nella scheda di un giocatore, e su ogni carta
  della rosa, c'è il campo **«Prezzo visto in gioco»**: scrivi la cifra che
  leggi sul mercato e tutto il resto — margini, BIN massimo, target, occasioni,
  verdetti di vendita, avvisi — funziona esattamente come con il prezzo
  automatico. Il prezzo scritto resta finché non ne arriva uno vero, e
  l'interfaccia lo dichiara («inserito da te il …»).
- **Controllare il perché** con `npm run diagnosi`, che distingue il blocco di
  Futbin da un problema del computer.

Un caso frequente su Windows: l'antivirus ispeziona il traffico cifrato e Node
non riconosce il suo certificato (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`). Si
risolve dicendo a Node di usare i certificati di sistema:

```powershell
$env:NODE_OPTIONS="--use-system-ca"; npm run dev
```

## Come funziona il collegamento a Futbin

Futbin **non ha un'API pubblica** e il browser non può interrogarlo
direttamente (CORS). L'app usa quindi un piccolo proxy Node locale
(`server/`) che:

1. chiama gli endpoint interni di Futbin (ricerca, prezzi, grafico);
2. normalizza le risposte in un formato stabile (`"1.2M"`, `"850K"`, `"1,200"`
   diventano tutti numeri di crediti);
3. mette in cache i risultati (prezzi 90 s, ricerche 10 min, grafici 30 min) e
   invia **una richiesta alla volta** con almeno 1,2 s di pausa;
4. se Futbin non risponde, cambia endpoint o blocca la richiesta, ricade su un
   **dataset demo** incluso e lo dichiara: l'interfaccia mostra il badge
   `DATI DEMO` invece di `Futbin FC27`. Dopo un errore Futbin resta in pausa
   un minuto, così l'app non rallenta a ogni chiamata.

Essendo endpoint non ufficiali possono cambiare: in quel caso non serve
toccare il codice, bastano le variabili d'ambiente.

| Variabile | Default | A cosa serve |
| --- | --- | --- |
| `FUT_YEAR` | `27` | anno del gioco negli URL Futbin (`27`, `26`…) |
| `FUTBIN_ENABLED` | `true` | `false` per lavorare solo sul dataset demo |
| `FUTBIN_SEARCH_URL` | `.../search` | endpoint di ricerca |
| `FUTBIN_PRICES_URL` | `.../<anno>/playerPrices` | endpoint prezzi |
| `FUTBIN_GRAPH_URL` | `.../<anno>/playerGraph` | endpoint storico |
| `FUTBIN_SBC_URL` | `.../<anno>/squad-building-challenges` | pagina delle SBC |
| `FUTBIN_OBJECTIVES_URL` | `.../<anno>/objectives` | pagina degli obiettivi |
| `FUTBIN_MIN_INTERVAL_MS` | `1200` | pausa minima fra due richieste |
| `FUTBIN_COOLDOWN_MS` | `60000` | pausa dopo un errore |
| `FUTBIN_TIMEOUT_MS` | `9000` | timeout per richiesta |
| `PORT` | `8787` | porta del proxy |
| `HOST` | `127.0.0.1` | `0.0.0.0` per accettare i dispositivi della rete locale |

**L'anno del gioco.** Negli indirizzi di Futbin compare l'anno (`/27/`,
`/26/`…) e cambia a ogni settembre. L'app punta a **FC27** e, se quelle pagine
non rispondessero, prova gli anni vicini e adotta quello vivo, dichiarandolo
nel badge in alto e in `npm run diagnosi`: una rete di sicurezza per il
passaggio al gioco successivo, non un cambio di gioco. Volendo si forza:

```bash
FUT_YEAR=26 npm run dev
```

Futbin è un servizio di terzi con propri termini d'uso: tieni il traffico a
ritmo umano (i limiti di default servono a questo) e usa l'app per il tuo
club, non per rivendere i dati.

## Struttura

```
shared/          logica pura, condivisa fra proxy e browser e coperta da test
  market.mjs     tassa, margine, BIN massimo, prezzo di pareggio
  calendar.mjs   il ciclo settimanale di Ultimate Team e le sue fasi
  catalysts.mjs  forma dei catalizzatori e regole di corrispondenza
  scoring.mjs    punteggio delle occasioni e ragioni in chiaro
  alerts.mjs     regole degli avvisi
  roster-import.mjs  lettura della rosa incollata
  text.mjs       confronto dei nomi senza accenti
  quotes.mjs     unione fra prezzi automatici e prezzi scritti a mano
  demo.mjs       dataset demo, usato sia dal proxy sia dall'app statica
server/
  index.mjs   avvio del server locale e indirizzi per il telefono
  router.mjs  rotte HTTP (/api/health, /api/search, /api/player/:id, /api/quotes, /api/catalysts)
  futbin.mjs  client Futbin: fetch, normalizzazione, cache, rate limit
  catalysts.mjs  lettura delle pagine SBC e obiettivi di Futbin
  util.mjs    parsing prezzi, cache TTL, coda di richieste
test/          test della logica (node --test)
api/
  index.mjs   stesse rotte come funzione serverless per il deploy
public/
  sw.js       service worker: installazione sul telefono e uso offline
  manifest.webmanifest  nome, icone e colori dell'app installata
src/
  lib/market.ts   tutta la matematica: tassa, margine, BIN massimo, pareggio
  lib/api.ts      client delle rotte del proxy
  lib/AppStore.tsx  stato persistito in localStorage
  pages/          Occasioni, Mercato, Watchlist, Calcolatore, Portafoglio, Avvisi, Impostazioni
```

## Verifiche

```bash
npm test          # test della logica: tasse, margini, calendario, punteggi, avvisi
npm run build     # typecheck + build
npm run lint      # oxlint
npm run diagnosi  # prova i collegamenti a Futbin dalla tua connessione
```

`npm run diagnosi` è il comando da usare quando i prezzi non arrivano: prova
ricerca, prezzi, storico e pagine SBC uno per uno e stampa l'errore vero,
invece del silenzioso ripiego sul dataset demo.

Per il collaudo completo dell'app, passo per passo, c'è
**[COLLAUDO.md](COLLAUDO.md)**: controlli automatici, diagnosi del
collegamento, prova sul computer con i conti verificabili a mano, prova dal
telefono e prova offline.
