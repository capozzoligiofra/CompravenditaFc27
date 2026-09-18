# FC27 Trader

Assistente per la compravendita di carte su EA FC 27 Ultimate Team: cerca un
giocatore, legge il prezzo di mercato da **Futbin**, e calcola i numeri che
servono davvero per guadagnarci — prezzo massimo di acquisto, prezzo di
rivendita, profitto al netto della tassa EA del 5%.

Non automatizza nulla dentro il gioco e non tocca il tuo account EA: è uno
strumento di analisi e di contabilità personale.

## Cosa fa

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
| `FC27_YEAR` | `27` | anno del gioco usato negli URL Futbin |
| `FUTBIN_ENABLED` | `true` | `false` per lavorare solo sul dataset demo |
| `FUTBIN_SEARCH_URL` | `.../search` | endpoint di ricerca |
| `FUTBIN_PRICES_URL` | `.../27/playerPrices` | endpoint prezzi |
| `FUTBIN_GRAPH_URL` | `.../27/playerGraph` | endpoint storico |
| `FUTBIN_MIN_INTERVAL_MS` | `1200` | pausa minima fra due richieste |
| `FUTBIN_COOLDOWN_MS` | `60000` | pausa dopo un errore |
| `FUTBIN_TIMEOUT_MS` | `9000` | timeout per richiesta |
| `PORT` | `8787` | porta del proxy |

Esempio:

```bash
FC27_YEAR=27 FUTBIN_MIN_INTERVAL_MS=2000 npm run dev
```

Futbin è un servizio di terzi con propri termini d'uso: tieni il traffico a
ritmo umano (i limiti di default servono a questo) e usa l'app per il tuo
club, non per rivendere i dati.

## Struttura

```
server/
  index.mjs   rotte HTTP (/api/health, /api/search, /api/player/:id, /api/quotes)
  futbin.mjs  client Futbin: fetch, normalizzazione, cache, rate limit
  demo.mjs    dataset di riserva con storico generato in modo deterministico
  util.mjs    parsing prezzi, cache TTL, coda di richieste
src/
  lib/market.ts   tutta la matematica: tassa, margine, BIN massimo, pareggio
  lib/api.ts      client delle rotte del proxy
  lib/AppStore.tsx  stato persistito in localStorage
  pages/          Mercato, Watchlist, Calcolatore, Portafoglio, Impostazioni
```

## Verifiche

```bash
npm run build   # typecheck + build
npm run lint    # oxlint
```
