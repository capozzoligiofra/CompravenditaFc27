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
- **Portafoglio** — registro degli acquisti: capitale investito, profitto già
  incassato, profitto latente ai prezzi correnti, percentuale di trade in
  utile ed esportazione CSV.
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
su `main` (workflow `.github/workflows/pages.yml`, che attiva Pages da sé alla
prima esecuzione). L'indirizzo è:

```
https://capozzoligiofra.github.io/CompravenditaFc27/
```

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
| `FC27_YEAR` | `27` | anno del gioco usato negli URL Futbin |
| `FUTBIN_ENABLED` | `true` | `false` per lavorare solo sul dataset demo |
| `FUTBIN_SEARCH_URL` | `.../search` | endpoint di ricerca |
| `FUTBIN_PRICES_URL` | `.../27/playerPrices` | endpoint prezzi |
| `FUTBIN_GRAPH_URL` | `.../27/playerGraph` | endpoint storico |
| `FUTBIN_SBC_URL` | `.../27/squad-building-challenges` | pagina delle SBC |
| `FUTBIN_OBJECTIVES_URL` | `.../27/objectives` | pagina degli obiettivi |
| `FUTBIN_MIN_INTERVAL_MS` | `1200` | pausa minima fra due richieste |
| `FUTBIN_COOLDOWN_MS` | `60000` | pausa dopo un errore |
| `FUTBIN_TIMEOUT_MS` | `9000` | timeout per richiesta |
| `PORT` | `8787` | porta del proxy |
| `HOST` | `127.0.0.1` | `0.0.0.0` per accettare i dispositivi della rete locale |

Esempio:

```bash
FC27_YEAR=27 FUTBIN_MIN_INTERVAL_MS=2000 npm run dev
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
npm test        # test della logica: tasse, margini, calendario, punteggi, avvisi
npm run build   # typecheck + build
npm run lint    # oxlint
```
