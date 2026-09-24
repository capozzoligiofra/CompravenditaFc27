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
- **Scheda della carta** — ogni nome scritto nell'app si può cliccare e apre
  la sua scheda: caratteristiche, prezzo attuale con il nome di chi l'ha
  segnato, storico, prezzo stimato, piano di trade, e il campo per cambiare il
  prezzo. È una sola per tutta l'app, si apra dai prezzi, dalla watchlist,
  dalla rosa o dalle proposte.
- **Mercato** — la ricerca per trovare carte e le ultime aperte: da qui si
  entra nella scheda. Aprire una carta vuol dire seguirla. Il catalogo lo fate
  voi: se una carta non c'è, la crei con nome e valutazione e da quel momento
  la trovano tutti quelli del listino.
- **Listino condiviso** — i prezzi sono in comune: quello che segni tu lo
  vedono gli altri e viceversa, con il nome di chi l'ha scritto. Rosa e
  watchlist restano tue, ma ti seguono su tutti i dispositivi. Serve un
  servizio da mettere online una volta sola: sta in `server-php/`.
- **Prezzi** — il pannello per aggiornare le quotazioni in fretta: una riga
  per carta, si scrive la cifra e si preme Invio per salvare e passare alla
  successiva. In cima quelle senza prezzo e quelle più vecchie.
- **Prezzo stimato** — se i prezzi li scrivi tu, quello che hai segnato
  invecchia mentre il mercato si muove: sotto a ogni carta l'app dice quanto
  dovrebbe costare *adesso*, con quanto ci si può contare e i due momenti
  della settimana in cui conviene comprare e vendere.
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
accorge da sola, mostra il badge `PREZZI VOSTRI` e lavora con i prezzi che
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
lì i prezzi sono solo i vostri. Se vuoi prezzi automatici su un indirizzo pubblico
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
conosca, ma la tua rosa, la watchlist e i tuoi conti restano sul telefono. Sul
proxy finiscono soltanto le quotazioni delle carte (l'archivio dei prezzi),
che non dicono niente di te.

### Cosa funziona senza rete

Watchlist, portafoglio e calcolatore vivono nel telefono, quindi funzionano
sempre. I prezzi invece no: l'app mostra l'ultima risposta ricevuta e la
segnala con l'etichetta **OFFLINE** e la scritta «prezzi salvati in memoria,
non aggiornati», così non rischi di comprare guardando un prezzo di ieri.

## Darla a qualcun altro

L'indirizzo pubblico è <https://capozzoligiofra.github.io/CompravenditaFc27/>:
si manda com'è, in chat. Chi lo apre trova una scheda di benvenuto che dice in
tre righe cos'è l'app, che i prezzi se li scrive lui e che i dati restano nel
suo telefono. Il link porta con sé un'anteprima (`public/social.png`, disegnata
in `scripts/social-card.html`: per rifarla basta aprire quel file nel browser e
catturarlo a 1200×630).

Cosa trova chi la apre dipende da una cosa sola: se si collega al listino
condiviso o no.

- **Senza collegarsi** ha la sua copia: rosa, watchlist e prezzi vivono nel suo
  browser, non si mescolano con i tuoi e tu non vedi i suoi.
- **Collegandosi** (*Opzioni → Listino condiviso*, indirizzo e nome) entra nel
  listino comune: vede i prezzi che avete segnato voi e i suoi li vedete voi,
  con il nome accanto. La sua rosa resta sua.

In *Opzioni → Condividi l'app* c'è il pulsante che apre il foglio di
condivisione del telefono (o copia l'indirizzo). Se dai anche l'indirizzo del
listino, ricordati che chi ce l'ha può scrivere prezzi.

Prima di mandarla in giro, tre controlli che valgono un minuto:

- [ ] *Settings → Pages → Source* è su **GitHub Actions** (altrimenti esce una
      pagina bianca);
- [ ] l'indirizzo si apre in una finestra anonima, dove non ci sono i tuoi
      dati: è quello che vedrà l'altra persona;
- [ ] se l'indirizzo che stai per mandare comincia per `192.168.`, non
      funzionerà fuori da casa tua: quello è il server locale, vale solo sulla
      tua rete e solo a computer acceso.

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
| Arrivo dei premi | Tutti aprono pacchetti | Offerta ↑, prezzi ↓ — **si compra** |
| Il giorno prima della promo | Si svende la rosa per fare crediti | Prezzi ai minimi — **si compra** |
| Uscita promo e Champions | Nuovi contenuti, apre la Weekend League | Domanda ↑ — **si vende** |
| Weekend League in corso | Si gioca e si ricompra | Domanda alta, prezzi tengono |
| Secondo arrivo di premi | Seconda ondata di pacchetti | Prezzi ↓ |
| Notte e primo mattino | Pochi acquirenti online | Occasioni sotto prezzo |

L'app riconosce da sola in che fase sei e te lo dice in cima alla pagina
Occasioni, con il conto alla rovescia per il prossimo appuntamento.

Gli orari di partenza, oggi, sono questi:

| Appuntamento | Quando (ora italiana) |
| --- | --- |
| Premi Rivals | giovedì 09:00 — in FC27 è il reset settimanale |
| Fine Champions e premi | lunedì 09:00, quando chiude la Weekend League |
| Nuova promo + Champions | venerdì 20:00 |
| Aggiornamento settimanale | mercoledì 19:00 |

**Gli orari li decidi tu, perché li decide EA.** Per anni i premi Rivals sono
arrivati di lunedì, poi sono passati al giovedì; e nessuna fonte ce lo dice,
visto che i siti che pubblicano il calendario non consentono l'accesso ai
programmi. Quindi i quattro appuntamenti — premi Rivals, premi Champions,
uscita promo, aggiornamento infrasettimanale — stanno in *Opzioni → Orari
della settimana*, con giorno e ora modificabili. Il modo più veloce è il
pulsante **«È appena successo»**: lo premi nel momento in cui arrivano i
premi e l'app prende giorno e ora da lì.

Non è un dettaglio estetico: da quegli orari nascono le fasi, i conti alla
rovescia **e il prezzo stimato**. Se l'app crede che i premi arrivino lunedì
e invece arrivano giovedì, la stima sbaglia segno proprio nel giorno in cui
conta di più. Gli orari seguono il tuo nome sugli altri dispositivi, come il
resto dei dati personali.

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
Un'app personale come questa non può ottenere quell'accesso: **EA ha
dichiarato di non accettare altre richieste di partnership**, non pubblica
indirizzi né specifiche, e in ogni caso quell'API espone i dati del proprio
club, non le quotazioni del mercato. Verificato a settembre 2026: se un giorno
il programma si riaprisse, l'app è già pronta a collegarsi a qualsiasi API con
due variabili d'ambiente.

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
- **Farlo in serie, dal pannello *Prezzi*.** È la via più veloce: l'elenco di
  tutte le carte che segui, ordinato per urgenza (prima quelle senza prezzo,
  poi quelle più vecchie), un campo per riga, e **Invio** che salva e sposta
  il cursore sulla carta dopo. Si scrive anche `44k` o `1,2M`. I filtri
  *Da aggiornare / La mia rosa / Watchlist* servono a fare un giro per volta,
  e il contatore in alto dice quante ne restano.
- **Incollare un elenco JSON.** In *Prezzi* c'è «Prezzi da un elenco JSON»,
  per chi i prezzi li tiene in un foglio o in un file:
  `[{"nome": "Klara Bühl", "prezzo": "8.2K"}, …]`. Accetta le chiavi in
  italiano o in inglese, i prezzi come `8.2K`, `14K`, `1,2M` o `44000`, e
  anche solo il pezzo copiato in mezzo all'elenco, senza parentesi quadre.
  Prima di applicare mostra cosa ha capito — quante carte, quante nuove,
  quante righe scartate — perché un import silenzioso che sbaglia i nomi fa
  più danno di uno che non parte. Le carte che non conosci vengono create; se
  nell'elenco non c'è la valutazione, la scrivi dalla scheda della carta.
- **Aggiornarli in blocco.** In *Prezzi* (e in *Conti*) c'è «Aggiorna i prezzi in blocco»:
  si incolla un elenco `Nome prezzo`, una riga per carta, e si sistemano tutti
  insieme. I nomi vengono cercati fra le carte che l'app già conosce, senza
  rete; **quelli che non esistono ancora diventano carte nuove**, perché il
  catalogo cresce mentre lo usate. Il confronto fra nomi resta severo: un nome
  che somiglia a un altro non viene assegnato alla carta sbagliata, casomai ne
  nasce una in più che puoi correggere.
- **Lo storico se lo costruisce l'app.** Ogni prezzo che vede — automatico o
  scritto da te — diventa un punto di storia, uno al giorno per carta. Dopo
  qualche giorno tornano a funzionare i segnali che hanno bisogno del passato:
  «costa meno della media della settimana», «è vicino al minimo», il grafico.
- **Stimare i giorni in mezzo.** Il prezzo che hai segnato invecchia; il
  mercato no. L'app calcola quanto dovrebbe costare *adesso* quella carta —
  vedi qui sotto.
- **Controllare il perché** con `npm run diagnosi`, che distingue il blocco di
  Futbin da un problema del computer.
- **Cambiare sorgente**: collegare un'API che consenta l'accesso, qui sotto.

### Il prezzo stimato fra un'osservazione e l'altra

Se segni i prezzi a mano, li segni quando puoi: martedì sera, poi sabato
mattina. In mezzo il mercato si muove lo stesso, e un prezzo di tre giorni fa
letto come se fosse di adesso porta a comprare male.

Sotto al prezzo di ogni carta, nella scheda del *Mercato* e su ogni carta della
rosa, compare quindi **PREZZO STIMATO ORA**: quanto dovrebbe costare in questo
momento, partendo dall'ultimo prezzo che hai osservato.

Il calcolo mette insieme tre cose:

1. **La fase della settimana** di quando l'hai segnato e quella di adesso. Il
   giovedì dei premi e la vigilia della promo riempiono il mercato e i prezzi
   scendono; l'uscita della promo e la Weekend League li tirano su. Sono gli
   stessi tempi che l'app usa per le occasioni.
2. **I tuoi prezzi.** Con almeno sei punti di storico su quella carta — e
   almeno tre nella stessa fase — l'app smette di usare i valori generali e
   impara quanto vale ogni fase *per quella carta specifica*, perché un fodder
   83 e una carta da un milione non si muovono allo stesso modo. Finché i dati
   sono pochi, i tuoi pesano in proporzione: non decidono da soli.
3. **La tendenza recente**, che però si smorza col passare dei giorni:
   estrapolare una settimana in avanti sarebbe inventare.

Due regole che la stima rispetta sempre, perché una stima non è un prezzo:

- **non si allontana mai più del 25%** dall'ultimo prezzo osservato, e più
  l'osservazione è vecchia meno si muove;
- **dice sempre di essere una stima**, con l'affidabilità accanto (*alta*,
  *media*, *bassa*, *molto bassa*, in base a quanto è vecchio il prezzo di
  partenza e a quanti punti di storico ci sono) e la frase che spiega da dove
  nasce. Se non hai mai segnato un prezzo, non compare: senza dati non si
  inventa niente.

Sotto la stima ci sono i due momenti utili dei sette giorni successivi:

```
▼ Atteso più basso  giovedì alle 08:00 · premi in consegna (-5,0%)
▲ Atteso più alto   venerdì alle 19:00 · uscita promo e champions (+3,0%)
```

Il primo è quando conviene comprare, il secondo quando conviene vendere, con
la variazione attesa rispetto ad adesso. Il numero vale quanto vale
l'affidabilità che sta scritta sopra: è un'indicazione su *quando* muoversi,
non una promessa su *quanto*.

### Chi ci lascia entrare? `npm run sonda`

Futbin dice no, ma non è detto che valga per tutti: fut.gg, FUTWIZ e gli altri
hanno politiche loro, e cambiano nel tempo. Invece di indovinare, si chiede:

```bash
npm run sonda
```

Per ogni sito la sonda guarda se il nome si risolve, **cosa dice il suo
`robots.txt`** — che è il posto dove un sito scrive nero su bianco cosa
concede ai programmi — se risponde a una richiesta onesta o c'è una protezione
anti-bot, e solo dove è consentito prova l'indirizzo dei dati e dice se c'è un
prezzo dentro. Si presenta con il proprio nome e non finge di essere un
browser; davanti a un divieto scrive «no» e passa oltre.

Va lanciata **dalla tua connessione**: da un datacenter le risposte sono
diverse (e quasi sempre peggiori). Con `SONDA_SITI=https://tal.dev npm run sonda`
si prova un indirizzo qualsiasi, e con la chiave si vede anche cosa c'è oltre
la serratura:

```powershell
$env:FUT_API_KEY="la-tua-chiave"; npm run sonda
```

**Com'è andata finora** (prova del 23 settembre 2026, da una connessione
domestica italiana):

| Sito | Esito |
| --- | --- |
| fut.gg | HTTP 200 ma pagina di verifica Cloudflare |
| FUTWIZ | HTTP 403, sfida Cloudflare |
| FUTBIN | HTTP 403, pagina di verifica Cloudflare |
| futdatabase.com | HTTP 429 già sulla pagina iniziale |
| fut-db.com | risponde; i dati chiedono la chiave (HTTP 401) |

Tre porte chiuse di proposito e una che vuole una chiave: è la ragione per
cui l'app è fatta per funzionare **senza** sorgente automatica, con i prezzi
che scrivete voi nel listino condiviso. Vale la pena rilanciare la sonda ogni
tanto: le politiche cambiano, e il giorno che una si apre bastano due
variabili per collegarla.

Se trova una porta aperta, collegarla non richiede codice nuovo: bastano le
variabili qui sotto.

### Sorgente alternativa: un'API con chiave

Se trovi un servizio di dati FUT che **consente l'accesso programmatico** —
cioè pubblica un'API con chiave, invece di vietarla come fa Futbin — lo si
collega senza toccare il codice. Nessun fornitore è scritto dentro l'app di
proposito: questi servizi nascono, cambiano nome e chiudono, e un indirizzo
nel codice diventa presto un indirizzo morto.

Per **FUT-DB** (api.fut-db.com) c'è una preimpostazione pronta:

```powershell
$env:FUT_API_PRESET="fut-db"; $env:FUT_API_KEY="la-tua-chiave"; npm run diagnosi
```

Attenzione a cosa include il loro piano gratuito: nella loro documentazione la
**ricerca** (`POST /api/players/search`) e i **prezzi**
(`GET /api/players/{id}/price`) sono segnati *premium only*. Con una chiave
gratuita l'app può leggere l'anagrafica dei giocatori ma non le quotazioni: in
quel caso lo dichiara, continua a usare il servizio per la ricerca e i prezzi
restano quelli scritti a mano.

**Non sai come è fatta l'API del tuo servizio?** Con la chiave in mano:

```powershell
$env:FUT_API_KEY="la-tua-chiave"; $env:FUT_API_SITE="https://il-servizio.tld"; npm run esplora
```

`npm run esplora` prova dalla tua connessione le combinazioni più comuni di
indirizzo, intestazione della chiave e percorsi, e stampa la configurazione
esatta da incollare. Se non trova niente, dice se la chiave è stata rifiutata
o se il servizio non ha mai risposto.

Servono tre valori (più due se i percorsi non sono quelli standard):

```powershell
$env:FUT_API_BASE="https://esempio.tld/api"
$env:FUT_API_KEY="la-tua-chiave"
npm run dev
```

| Variabile | Default | A cosa serve |
| --- | --- | --- |
| `FUT_API_BASE` | — | indirizzo dell'API (senza barra finale) |
| `FUT_API_KEY` | — | la tua chiave |
| `FUT_API_KEY_HEADER` | `X-AUTH-TOKEN` | intestazione con cui inviare la chiave |
| `FUT_API_SEARCH_PATH` | `/players/search` | percorso della ricerca |
| `FUT_API_SEARCH_PARAM` | `name` | nome del parametro di ricerca |
| `FUT_API_SEARCH_METHOD` | `GET` | `POST` se la ricerca vuole il nome nel corpo |
| `FUT_API_PRESET` | — | `fut-db` per usare indirizzi e percorsi già pronti |
| `FUT_API_MAX_QUOTES` | `12` | quante quotazioni chiedere per schermata (piani a consumo) |
| `FUT_API_PRICE_PATH` | `/players/{id}/price` | percorso dei prezzi (`{id}` viene sostituito) |

Poi `npm run diagnosi` dice se l'indirizzo risponde, se la chiave è accettata
e se i prezzi vengono letti: gli errori sono espliciti (401 chiave rifiutata,
404 percorso sbagliato, 429 limite di richieste superato, risposta non JSON).

Con un'API a consumo l'app va leggera: le ricerche restano in cache un'ora, i
prezzi un quarto d'ora, e per schermata chiede al massimo dodici quotazioni
(`FUT_API_MAX_QUOTES`). Le altre carte restano ai prezzi scritti a mano.

L'app legge le risposte in modo tollerante: accetta elenchi sotto `items`,
`data`, `results` o `players`, nomi di campo diversi per nome e valutazione, e
prezzi scritti come numero, come `"1,450,000"` o come `"1.4M"`. Due cose non
arrivano quasi mai da queste API e restano coperte diversamente: lo **storico
dei prezzi**, che l'app si costruisce annotandone uno al giorno, e **SBC e
obiettivi**, che si aggiungono a mano dalla pagina Occasioni.

Con `FUT_PROVIDER=futbin` si torna a Futbin anche avendo configurato un'API.

## Il listino condiviso

I prezzi di Ultimate Team sono un fatto: se una carta sta a 42.000, sta a
42.000 per tutti. Tenerli su un dispositivo solo significa riscriverli su ogni
telefono e non sapere mai quale sia il più fresco. Con il listino condiviso
si scrivono una volta e valgono per tutti.

Il servizio sta in **`server-php/`** e vive su un hosting Linux qualunque
(PHP + MySQL): tre file da caricare via FTP, un database da creare dal
pannello, e il passo per passo è in `server-php/LEGGIMI.md`. Poi, nell'app:
*Opzioni → Listino condiviso*, indirizzo e nome, **Collegati**.

Cosa è in comune e cosa no:

| | Dove vive | Chi lo vede |
| --- | --- | --- |
| Prezzi e storico | sul server | tutti, con il nome di chi li ha scritti |
| Le carte che segui | sul server, legate al tuo nome | solo tu |
| Rosa, watchlist, impostazioni | sul server, legate al tuo nome | solo tu, su tutti i tuoi dispositivi |
| Avvisi | nel dispositivo | solo quel dispositivo |

**Invitare qualcuno.** Digitare un indirizzo su un telefono è il punto in cui
la gente si arrende, quindi non glielo si fa fare: in *Opzioni → Listino
condiviso* c'è **Invita qualcuno**, che prepara un link con dentro già
l'indirizzo del listino. Chi lo apre trova una schermata che dice a quale
listino sta per collegarsi e gli chiede solo il nome; da lì entra e si trova
i prezzi già scritti dagli altri, con il nome di chi li ha segnati. Non ci si
collega da soli: l'indirizzo arriva da un link, cioè da fuori, e si mostra in
chiaro prima di chiedere conferma.

**Le carte seguite restano di ciascuno.** In comune ci sono i prezzi, non
l'elenco delle carte: le tue sono quelle della rosa, della watchlist e quelle
di cui hai aperto la scheda. Le carte che esistono solo perché qualcun altro
ne ha segnato il prezzo stanno nel filtro **Dal listino** del pannello
*Prezzi*, separate: aprirne una è il gesto con cui la adotti, e da lì in poi
compare fra le tue e nelle tue proposte.

**Come si decide chi ha ragione.** Due persone possono segnare la stessa carta
a dieci secondi di distanza, e un telefono può restare offline per un giorno.
La regola è una sola e vale nei due sensi: **vince l'osservazione più
recente** — non «vince il server», altrimenti il prezzo che hai appena visto
in gioco perderebbe contro quello di ieri sera. Per i dati personali vale la
stessa regola, con una cautela: una copia vuota non cancella una copia piena,
così il telefono nuovo riceve la rosa invece di azzerarla.

**Quando non c'è linea** si continua a scrivere: i prezzi restano nel telefono
e partono da soli appena la connessione torna. In alto, accanto al nome
dell'app, una scritta dice come sta il listino (`LISTINO IN COMUNE`,
`SINCRONIZZO…`, `LISTINO NON RAGGIUNGIBILE`).

**Il nome non è una password**, ed è bene saperlo: chi conosce l'indirizzo può
scrivere, e scrivendo il tuo nome scriverebbe a nome tuo. È la scelta fatta
per non dover gestire registrazioni e password — va bene fra persone che si
conoscono. Il punto da cambiare, se un domani servisse, è uno solo: l'azione
`entra` in `api.php`.

## Il database dei prezzi

Il proxy tiene un **database SQLite** (`dati/archivio.sqlite`), usando
`node:sqlite` integrato in Node: nessuna dipendenza da installare, nessun
servizio da pagare, un file che puoi copiare o cancellare. Su versioni di Node
troppo vecchie ricade su un file JSON con la stessa interfaccia
(`FUT_DB_DRIVER=json` per forzarlo).

Tabelle: `giocatori` (anagrafica), `prezzi` (ultima quotazione per carta e
piattaforma), `storico` (un prezzo al giorno), `interesse` (le carte che segui).

Non inventa prezzi — quelli arrivano da una sorgente o li scrivi tu — ma
risolve quattro problemi concreti:

- **le richieste si pagano**: la quotazione si chiede una volta e resta,
  invece di ripartire a ogni schermata;
- **lo storico non lo regala nessuno**: ogni prezzo registrato diventa un
  punto, ed è su quello che funzionano i segnali «sotto la media della
  settimana» e «vicino al minimo»;
- **i dispositivi sono due**: un prezzo scritto sul telefono finisce nel
  database del proxy e lo ritrovi sul computer;
- **le domande d'insieme**: con un database si può chiedere *quali fra tutte
  le carte raccolte sono scese di più negli ultimi tre giorni*
  (`GET /api/movimenti?giorni=3&verso=calo`). È la domanda che un file non
  regge, ed è quella che fa nascere le occasioni fuori dalla watchlist.

L'ordine con cui l'app cerca un prezzo è: *sorgente automatica → database →
niente*. Un prezzo vero di ieri vale più di uno inventato oggi — e infatti
prezzi inventati non ne esistono più: se non c'è, l'app lo dice invece di
riempire il buco.

### Tenerlo aggiornato

L'app dichiara al proxy quali carte segui (watchlist e rosa). Poi:

```bash
npm run aggiorna     # aggiorna adesso quelle carte e chiude
```

Oppure lo fa il server mentre è acceso:

```powershell
$env:FUT_REFRESH_MINUTES="180"; npm run dev    # ogni tre ore
```

Di default l'aggiornamento automatico è **spento**, perché consuma richieste:
ha senso accenderlo con una sorgente che le concede.

| Variabile | Default | A cosa serve |
| --- | --- | --- |
| `FUT_DB_DRIVER` | automatico | `json` per non usare SQLite |
| `FUT_ARCHIVE_FILE` | `dati/archivio.sqlite` | dove tenere il database |
| `FUT_ARCHIVE_MAX` | `400` | quante carte conservare |
| `FUT_REFRESH_MINUTES` | `0` (spento) | ogni quanto aggiornare mentre il server è acceso |
| `FUT_REFRESH_MAX` | `40` | quante carte per giro |
| `FUT_REFRESH_PLATFORMS` | `ps` | piattaforme da aggiornare |

### Dove stanno i dati, e se serve tenere il computer acceso

Domanda giusta, e la risposta è a strati, perché i dati non stanno tutti nello
stesso posto.

**1. Il listino dei prezzi sta sul server condiviso.** È il servizio PHP in
`server-php/`, caricato una volta sul tuo spazio Aruba: lì vivono i prezzi di
tutti, lo storico e i dati personali di ciascuno. Gira solo quando qualcuno lo
chiama — è un hosting, non una macchina da tenere accesa — e non costa niente
più dello spazio web che hai già. Istruzioni: `server-php/LEGGIMI.md`.

**2. Ogni dispositivo ne tiene una copia.** Prezzi, rosa e watchlist restano
anche nel `localStorage` del browser, così l'app funziona in aereo, in
metropolitana e col server spento: quello che scrivi offline parte da solo
appena torna la linea. **Non serve tenere acceso nessun computer.**

**3. Il database SQLite del proxy è un'altra cosa ancora.** Quello
(`dati/archivio.sqlite`) nasce solo se avvii `npm run dev` sul tuo computer, e
serve ai prezzi automatici quando una sorgente è configurata. È acceso quanto
il computer, e con il listino condiviso attivo non è più necessario a niente
di essenziale.

**4. Su GitHub Pages non gira nulla di tutto questo.** Pages serve file
statici — HTML, CSS, JavaScript — e non esegue né PHP né Node né un database.
L'app scaricata da lì gira nel browser e chiama il listino su Aruba: è per
questo che il listino sta là e non qui.

Riassunto: **no, non devi tenere il computer acceso.** Il pezzo che deve stare
sempre in piedi è il servizio su Aruba, e quello è un hosting.

### Da dove arrivano i dati (e perché non facciamo scraping)

Il database si riempie da tre rubinetti: una **sorgente con API** consentita,
i **prezzi che scrivi tu**, e il tempo che passa (lo storico).

Quello che non fa, e non farà, è **raschiare i siti che lo vietano**. Futbin
risponde 403 a qualsiasi richiesta che non venga da un browser: è un controllo
di accesso, e aggirarlo — fingendosi Chrome, ruotando indirizzi, risolvendo i
controlli anti-bot — significa violare i loro termini, rischiare il blocco
della tua connessione e costruire una cosa che si rompe alla prima contromossa.
Lo stesso vale per gli endpoint interni della Web App di EA, che portano al ban
dell'account di gioco. Se un domani una fonte consente l'accesso, si collega
con due variabili d'ambiente e il database si riempie da solo.

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
   un minuto, così l'app non rallenta a ogni chiamata.

Essendo endpoint non ufficiali possono cambiare: in quel caso non serve
toccare il codice, bastano le variabili d'ambiente.

| Variabile | Default | A cosa serve |
| --- | --- | --- |
| `FUT_YEAR` | `27` | anno del gioco negli URL Futbin (`27`, `26`…) |
| `FUTBIN_ENABLED` | `true` | `false` per non cercare nemmeno una sorgente automatica |
| `FUTBIN_SEARCH_URL` | `.../search` | endpoint di ricerca |
| `FUTBIN_PRICES_URL` | `.../<anno>/playerPrices` | endpoint prezzi |
| `FUTBIN_GRAPH_URL` | `.../<anno>/playerGraph` | endpoint storico |
| `FUTBIN_SBC_URL` | `.../<anno>/squad-building-challenges` | pagina delle SBC |
| `FUTBIN_OBJECTIVES_URL` | `.../<anno>/objectives` | pagina degli obiettivi |
| `FUTBIN_MIN_INTERVAL_MS` | `1200` | pausa minima fra due richieste |
| `FUTBIN_COOLDOWN_MS` | `60000` | pausa dopo un errore |
| `FUTBIN_TIMEOUT_MS` | `9000` | timeout per richiesta |
| `FUT_API_BASE`, `FUT_API_KEY` | — | sorgente alternativa: vedi sopra |
| `FUT_PROVIDER` | automatico | forza la sorgente: `futbin` o `api` |
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
  forecast.mjs   prezzo stimato fra un'osservazione e l'altra, e finestre utili
  price-entry.mjs  l'elenco delle carte a cui serve un prezzo, per urgenza
  sync.mjs       chi ha ragione quando due dispositivi hanno prezzi diversi
  price-json.mjs lettura tollerante di un elenco di prezzi in JSON
  catalysts.mjs  forma dei catalizzatori e regole di corrispondenza
  scoring.mjs    punteggio delle occasioni e ragioni in chiaro
  alerts.mjs     regole degli avvisi
  roster-import.mjs  lettura della rosa incollata
  text.mjs       confronto dei nomi senza accenti
  quotes.mjs     unione fra prezzi automatici e prezzi scritti a mano
  catalog.mjs    il catalogo delle carte costruito da voi, e i suoi id stabili
server-php/     il listino condiviso da caricare su un hosting Linux
  api.php     tutte le chiamate del listino (prezzi, storico, dati personali)
  schema.sql  le tabelle MySQL, da eseguire una volta
  LEGGIMI.md  come metterlo online su Aruba, passo per passo
server/
  index.mjs   avvio del server locale e indirizzi per il telefono
  providers.mjs  sceglie la sorgente dati fra Futbin e l'API configurata
  rest-provider.mjs  client generico per un'API REST con chiave
  archive.mjs    sceglie il motore del database
  db.mjs         database SQLite: prezzi, storico, movimenti
  archive-json.mjs  riserva su file JSON con la stessa interfaccia
  router.mjs  rotte HTTP (/api/health, /api/search, /api/player/:id, /api/quotes, /api/catalysts)
  futbin.mjs  client Futbin: fetch, normalizzazione, cache, rate limit
  catalysts.mjs  lettura delle pagine SBC e obiettivi di Futbin
  util.mjs    parsing prezzi, cache TTL, coda di richieste
test/          test della logica (node --test)
api/
  index.mjs   stesse rotte come funzione serverless per il deploy
public/
  social.png  anteprima del link (sorgente: scripts/social-card.html)
  sw.js       service worker: installazione sul telefono e uso offline
  manifest.webmanifest  nome, icone e colori dell'app installata
src/
  lib/market.ts   tutta la matematica: tassa, margine, BIN massimo, pareggio
  lib/api.ts      client delle rotte del proxy
  lib/AppStore.tsx  stato persistito in localStorage
  lib/cloud.ts      client del listino condiviso
  lib/CloudSync.tsx il ciclo di sincronizzazione, in sottofondo
  pages/          Occasioni, Prezzi, Mercato, Watchlist, Calcolatore, Portafoglio, Avvisi, Impostazioni
```

## Verifiche

```bash
npm test          # test della logica: tasse, margini, calendario, punteggi, avvisi
npm run build     # typecheck + build
npm run lint      # oxlint
npm run diagnosi  # prova i collegamenti alla sorgente dalla tua connessione
npm run esplora   # scopre la forma dell'API di un servizio con chiave
npm run aggiorna  # aggiorna l'archivio dei prezzi delle carte che segui
```

`npm run diagnosi` è il comando da usare quando i prezzi non arrivano: prova
ricerca, prezzi, storico e pagine SBC uno per uno e stampa l'errore vero,
invece del silenzioso ripiego sui prezzi che avete già in casa.

Per il collaudo completo dell'app, passo per passo, c'è
**[COLLAUDO.md](COLLAUDO.md)**: controlli automatici, diagnosi del
collegamento, prova sul computer con i conti verificabili a mano, prova dal
telefono e prova offline.
