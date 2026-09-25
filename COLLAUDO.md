# Collaudo

Guida per provare l'app da capo sul computer, nell'ordine giusto: prima quello
che non dipende da internet, poi il collegamento vero a Futbin, poi il
telefono. Ogni passo dice **cosa deve succedere**, così si capisce subito se
qualcosa non va.

Serve [Node.js](https://nodejs.org) versione 20 o successiva (`node -v`) e git.

---

## 1. Scarica e installa

```bash
git clone https://github.com/capozzoligiofra/CompravenditaFc27
cd CompravenditaFc27
npm install
```

**Deve succedere:** l'installazione finisce senza errori rossi (gli avvisi
`npm notice` sono normali).

---

## 2. Controlli automatici

```bash
npm test          # logica: tasse, margini, calendario, punteggi, avvisi, import
npm run build     # controllo dei tipi + compilazione
npm run lint      # analisi del codice
```

**Deve succedere:**
- `npm test` → `# pass 50` e `# fail 0`;
- `npm run build` → `✓ built in …` e la riga del service worker;
- `npm run lint` → 5 avvisi (`warning`), **zero errori**. Sono avvisi noti e
  innocui su come React aggiorna lo stato.

---

## 3. Diagnosi del collegamento a Futbin

Questo è il passo più importante, perché è l'unico che non ho mai potuto
provare io: dall'ambiente in cui ho scritto l'app, Futbin è irraggiungibile.

```bash
npm run diagnosi
```

**Deve succedere:** quattro righe `[ OK ]` con un giocatore vero, i suoi
prezzi sulle tre piattaforme, i punti dello storico e le SBC riconosciute. La
prima riga dice anche su quale anno del gioco sta lavorando (FC26, FC27…): se
l'anno configurato non risponde, l'app passa da sola a quello giusto e lo
scrive.

Se invece compaiono righe `[ NO ]`, il comando stampa l'errore preciso e cosa
significa. Casi tipici:

| Errore | Significato | Cosa fare |
| --- | --- | --- |
| `403` / `503` | Futbin blocca le richieste automatiche | è la normalità: l'app lavora con i prezzi che scrivete voi |
| `non in formato JSON` | l'indirizzo risponde una pagina, non dati | l'endpoint è cambiato: serve aggiornare `FUTBIN_*_URL` |
| `404` | l'indirizzo non esiste più | prova un altro anno: `FUT_YEAR=25 npm run diagnosi` |
| `timeout` / `ENOTFOUND` | rete o DNS del computer | controlla la connessione |

Se hai collegato un'API alternativa, provala così (l'intestazione deve
mostrare il nome del sito configurato):

```powershell
$env:FUT_API_BASE="https://esempio.tld/api"; $env:FUT_API_KEY="chiave"; npm run diagnosi
```

Puoi provare con un altro giocatore:

```bash
DIAGNOSI_PLAYER=lautaro npm run diagnosi
```

**Copiami l'output di questo comando se qualcosa non passa**: da lì si capisce
esattamente cosa correggere.

---

## 3-bis. Chi ci lascia entrare

```bash
npm run sonda
```

- [ ] Stampa un riquadro per ogni sito (fut.gg, FUTWIZ, FUTBIN, futdatabase,
      fut-db) con dns, robots.txt, stato del sito ed eventuali indirizzi dati.
- [ ] Dove c'è una protezione anti-bot o un divieto nel `robots.txt`, si ferma
      e lo scrive: è il comportamento giusto, non un errore.
- [ ] In fondo c'è il riepilogo con il verdetto per ciascuno: quello va
      copiato e mandato, così si ragiona sui risultati veri.

---

## 4. L'app sul computer

```bash
npm run dev
```

Apri <http://localhost:5173>. In alto a destra c'è il badge della sorgente:
`Futbin FC27` in verde se il passo 3 è andato bene, `prezzi vostri` in grigio
altrimenti. Tutto quello che segue funziona in entrambi i casi.

### Occasioni (schermata iniziale)

- [ ] In cima c'è la fase del mercato (per esempio «Vigilia della promo») con
      il consiglio e il conto alla rovescia dei prossimi eventi.
- [ ] Le proposte hanno punteggio, prezzo di acquisto, rivendita, profitto
      stimato e almeno un motivo con la freccia verde o rossa.
- [ ] Non sono tutte «compra ora»: devono esserci anche «tieni pronto» e
      «osserva». Se fossero tutte uguali il consiglio non varrebbe niente.
- [ ] Aggiungi un catalizzatore a mano: titolo `SBC Serie A 84+`, valutazione
      `84`, lega `Serie A` → **deve** comparire fra i motivi dei giocatori di
      Serie A con valutazione 84 o più, e i loro punteggi salgono.

### Mercato e catalogo delle carte

- [ ] Cercando un nome che nessuno ha ancora creato, l'app **non inventa
      niente**: dice che non c'è e propone di crearla.
- [ ] Creando «Moise Kean» con valutazione 84 si apre subito la sua scheda.
- [ ] Un'altra persona collegata allo stesso listino trova quella carta
      cercandola, con il prezzo che le hai dato.
- [ ] Creando la stessa carta con lo stesso nome e la stessa valutazione da
      due dispositivi si ottiene **una carta sola**, non due doppioni.

### Mercato

- [ ] Cerca un giocatore: i risultati arrivano mentre scrivi.
- [ ] Aprendo una scheda vedi prezzo, minimo, massimo, variazione e grafico.
- [ ] Cambia piattaforma in alto (PlayStation / Xbox / PC): i prezzi cambiano.
- [ ] «Aggiungi alla watchlist» riempie i target da solo.

### Calcoli (la verifica dei conti)

Questi numeri sono verificabili a mano, ed è il modo migliore per controllare
che l'app non racconti storie. Inserisci acquisto `10000` e vendita `12000`:

- [ ] Incasso netto **11.400** (12.000 meno il 5% di tassa)
- [ ] Profitto **+1.400**
- [ ] ROI **+14,0%**
- [ ] Pareggio **10.526** (sotto questa cifra rivendere è una perdita)
- [ ] Nella tabella, margine 15% → compra entro **9.900**

### Prezzi scritti a mano

È la via normale: nessuna sorgente automatica è accessibile, quindi i prezzi
li scrivete voi (e con il listino condiviso valgono per tutti).

- [ ] Nella scheda di un giocatore scrivi una cifra in «Prezzo visto in gioco»
      e premi Salva: il prezzo in alto diventa quello, con scritto «inserito
      da te», e il piano di trade si ricalcola su quella cifra.
- [ ] Lo stesso prezzo compare in Watchlist e nei verdetti della rosa.
- [ ] In «Aggiorna i prezzi in blocco» incolla tre righe `Nome prezzo` di
      carte che non hai mai visto: il pulsante annuncia «3 carte da creare» e
      dopo l'applicazione le trovi nel pannello con il loro prezzo.
- [ ] Reincollando lo stesso nome con un prezzo diverso dice «tutte già
      conosciute» e aggiorna la carta esistente: nessun doppione.
- [ ] Un nome che somiglia a un altro (`Lautaro Martinz`) **non** viene
      assegnato alla carta sbagliata: nel peggiore dei casi ne nasce una in
      più, che puoi togliere.
- [ ] Riaprendo l'app il giorno dopo, il grafico di una carta mostra un
      secondo punto: l'app si costruisce lo storico da sola.
- [ ] Un prezzo scritto due giorni fa continua a dire **«2 giorni fa»** anche
      dopo aver girato per l'app: riaprire una schermata non lo fa sembrare
      fresco.

### Il pannello *Prezzi*

È la schermata da tenere aperta accanto al gioco.

- [ ] La pagina si apre da **Prezzi** nella barra in basso e mostra l'elenco
      delle carte che segui, con in cima quelle senza prezzo e quelle più
      vecchie.
- [ ] Scrivi una cifra nel primo campo e premi **Invio**: il prezzo si salva e
      il cursore passa da solo alla carta successiva, senza toccare il mouse.
- [ ] Funzionano le scorciatoie: `44k` diventa 44.000 e `1,2M` diventa
      1.200.000.
- [ ] La riga appena salvata **resta al suo posto** (diventa «fatto») invece di
      sparire: se saltasse via, scriveresti sulla carta sbagliata.
- [ ] I contatori in alto si aggiornano: «segnate oggi» sale, «da aggiornare»
      scende.
- [ ] I filtri *Da aggiornare / La mia rosa / Watchlist / Tutte* e il campo
      «filtra per nome» restringono l'elenco.
- [ ] «Aggiungi una carta»: cerchi un giocatore, premi Aggiungi e compare
      nell'elenco con il suo campo prezzo.

### La scheda della carta

- [ ] In *Prezzi*, *Watchlist*, *Conti* e *Occasioni* i nomi dei giocatori
      sono cliccabili (sottolineati) e aprono la stessa scheda.
- [ ] La scheda mostra valutazione, ruolo, club, campionato, nazione e
      versione, il prezzo attuale con scritto **chi** l'ha segnato e quando,
      il grafico, il prezzo stimato e il piano di trade.
- [ ] Dalla scheda si cambia il prezzo: scrivi una cifra in «Aggiorna il
      prezzo» e premi Salva; il prezzo in alto e il piano di trade si
      aggiornano subito, e con il listino collegato parte anche agli altri.
- [ ] Il grafico mostra solo lo storico vero: o quello che avete costruito
      voi, o nessun grafico.
- [ ] «← indietro» riporta da dove sei arrivato (prezzi, watchlist o rosa).
- [ ] Aprendo una carta che non seguivi, questa entra fra le tue: la ritrovi
      in *Prezzi* → «Tutte le mie».

### Orari della settimana

Sono il motore delle fasi e della stima, e EA li sposta: qui si correggono.

- [ ] *Opzioni → Orari della settimana* mostra quattro appuntamenti con
      giorno e ora.
- [ ] Nel momento in cui in gioco arrivano i premi, premi **«È appena
      successo»** sulla riga giusta: giorno e ora diventano quelli di adesso.
- [ ] Torni su *Occasioni*: la fase in cima è cambiata (per esempio «Premi in
      consegna») e il conto alla rovescia riparte dal nuovo orario.
- [ ] Anche il **prezzo stimato** cambia di conseguenza: sulla stessa carta,
      prima e dopo la correzione, la cifra stimata è diversa.
- [ ] Gli orari si ritrovano sull'altro dispositivo con lo stesso nome.

### Catalogo dei giocatori da CSV

- [ ] *Prezzi* → «Catalogo dei giocatori» → **Carica un CSV**: scegli il tuo
      file e dopo un istante dice quante carte ha letto e **quali colonne ha
      usato**.
- [ ] Cercando dal *Mercato* un giocatore che non hai mai aperto, adesso lo
      trova, con valutazione e club.
- [ ] Incollando un elenco di prezzi, i nomi presenti nel catalogo risultano
      **già conosciuti** (non «da creare») e prendono la valutazione da lì.
- [ ] Le colonne riconosciute vengono elencate nel messaggio: su un export
      vero devono risultare `common_name` e `overall_rating`, più `position`,
      `club`, `league`, `nationality`.
- [ ] Aprendo la scheda di una carta del catalogo si vedono ruolo, ruoli
      alternativi, club, campionato, nazione e le sei statistiche.
- [ ] Ricaricando la pagina il catalogo è ancora lì.
- [ ] **Controlla il server** (in *Opzioni → Listino condiviso*) risponde con
      le versioni, **quanti giocatori ci sono in archivio** e dice se manca
      qualche tabella.
- [ ] Dopo **Condividi con il gruppo**, quel numero è **uguale alle carte del
      CSV**, non una manciata: le carte vanno tutte sul server, non solo
      quelle con un prezzo.
- [ ] Ricondividendo lo stesso catalogo il numero **non raddoppia**.

### Doppioni

- [ ] Incolla un prezzo per un nome **senza valutazione** (per esempio
      «Klara Bühl 8.2K») **prima** di caricare il catalogo: nasce una carta
      senza voto.
- [ ] Carica il catalogo, che quel nome ce l'ha con il suo voto. Tornando in
      *Prezzi* compare il pannello **Doppioni** con «1 doppione unito».
- [ ] Il giocatore adesso compare **una volta sola**, con la valutazione
      giusta, e il prezzo che avevi scritto è **il suo**.
- [ ] Se era in watchlist, i tuoi target di acquisto e vendita sono ancora
      quelli; se avevi una posizione aperta, punta alla carta giusta.
- [ ] Ricaricando la pagina il doppione **non ricompare**.
- [ ] Con il listino collegato, un secondo dispositivo che sincronizza **non
      si riporta giù** il doppione.
- [ ] Un nome che nel catalogo corrisponde a **due giocatori diversi** (per
      esempio «Vitinha», che c'è a 90 e a 75) **non** viene unito: compare
      nell'elenco sotto, con i candidati.

### I prezzi si aggiornano da soli

- [ ] Con l'app aperta sulla pagina *Prezzi*, cambia un prezzo direttamente
      nel database: entro **un minuto** cambia anche sullo schermo, senza
      toccare niente.
- [ ] Cambiandone un altro e tornando sull'app da un'altra scheda, il prezzo
      nuovo c'è **subito**.
- [ ] Il pannello *Sorgente automatica* dice **quando** ha letto l'ultima
      volta, e il tempo avanza da solo.
- [ ] Se un prezzo della sorgente è coperto da uno tuo più recente, il
      pannello lo dice con il conteggio: «N in uso adesso (…coperti…)».

### Quando il server è più vecchio dell'app

- [ ] Con un `api.php` di una versione precedente, **Controlla il server**
      dice che il file è da ricaricare, con le due versioni.
- [ ] E soprattutto: la sincronizzazione **arriva in fondo lo stesso**. La
      sorgente è un di più, e non deve mai impedire ai prezzi, ai dati
      personali e al catalogo di sincronizzarsi.
- [ ] Dopo aver caricato il file nuovo, **Sincronizza ora** riprova la
      sorgente senza dover ricaricare la pagina.

### L'indirizzo del listino

- [ ] Incollando l'indirizzo copiato dalla barra del browser dopo una prova
      (`…/api.php?azione=salute`), l'app lo riduce a `…/api.php`.
- [ ] Un indirizzo già salvato storto si raddrizza da solo al primo avvio,
      senza doverlo reinserire.

### Sorgente automatica dei prezzi

- [ ] Con nel database una tabella `futbin_giocatori_gold`, in *Prezzi*
      compare il pannello **Sorgente automatica** con quante righe ha letto.
- [ ] Il pannello dice **quale colonna** sta usando per nome, valutazione,
      prezzo e data. Sono quelle giuste.
- [ ] I prezzi delle carte che segui si riempiono **da soli**, senza scrivere
      niente: dopo una sincronizzazione il filtro *Da aggiornare* si svuota.
- [ ] Un giocatore con lettere non inglesi nel nome (Bonmatí, Mbappé,
      Yıldız) prende il **suo** prezzo: se l'aggancio fallisse resterebbe
      semplicemente senza, senza nessun errore, quindi va guardato.
- [ ] Due carte con lo stesso nome e valutazione diversa (Vitinha 90 e 75)
      prendono **prezzi diversi**.
- [ ] Un prezzo scritto a mano **non sparisce**: resta nel listino con il tuo
      nome, e la sorgente lo copre solo finché è più fresca.
- [ ] Con anche `futbin_storico_gold`, il pannello dice quante righe di
      andamento ha trovato, e il grafico della carta mostra i punti passati.
- [ ] Se una colonna non viene riconosciuta, il pannello **lo dice** ed
      elenca i nomi veri delle colonne, invece di non mostrare prezzi e
      basta.
- [ ] Senza nessuna di quelle tabelle, il pannello **non compare** e l'app
      funziona esattamente come prima.
- [ ] **Con l'app appena installata**, senza nessuna carta seguita: i prezzi
      della sorgente compaiono lo stesso, nel filtro *Dalla sorgente*.
- [ ] Se la tabella **non ha la colonna della valutazione**, le carte
      prendono comunque il voto giusto dal catalogo.
- [ ] Una riga scritta con il nome lungo («Aitana Bonmatí Conca») finisce
      sulla **stessa carta** di quella scritta corto, non su una seconda.
- [ ] Un nome che nel catalogo vale due giocatori (Vitinha) resta **senza
      prezzo**, e il pannello lo dice con i due voti possibili.
- [ ] Le carte della sorgente **non** finiscono fra «Tutte le mie»: il
      contatore in alto non cambia finché non ne apri una.

### Lo stesso nome scritto in due forme

- [ ] Incolla un prezzo per «Aitana Bonmatí Conca» (il nome completo) mentre
      nel catalogo lei si chiama «Aitana Bonmatí»: **non** nasce una seconda
      carta, il prezzo va sulla sua.
- [ ] Funziona anche al contrario e con il solo cognome: «Putellas Segura»
      trova Alexia Putellas.
- [ ] Cercando dal *Mercato* «bonmati conca» la trova lo stesso.
- [ ] Un cognome che vale per **più persone** non abbina niente: «Mbappé» da
      solo non diventa né Kylian né Ethan, e «Haaland» né Erling né Markus.
- [ ] Dopo **Condividi con il gruppo**, un secondo dispositivo riconosce gli
      stessi nomi: le forme alternative viaggiano con il catalogo.
- [ ] **Dimentica i prezzi scaricati** svuota la copia locale del listino: le
      carte non mostrano più «da <nome>». Rosa, watchlist e i prezzi scritti
      da te restano al loro posto.
- [ ] **Condividi con il gruppo**: il pulsante mostra l'avanzamento a blocchi
      e finisce con «Catalogo condiviso: N carte». Se le tabelle del catalogo
      non ci sono, l'errore lo **dice** invece di parlare di «errore del
      servizio».
- [ ] Un secondo dispositivo che entra nel listino si ritrova lo stesso
      catalogo entro pochi secondi, **senza caricare nessun file**, e trova in
      ricerca un giocatore che non ha mai aperto.
- [ ] Con il catalogo caricato, segnare un prezzo e ricaricare: **il prezzo
      c'è ancora**. (Un catalogo troppo grande non deve mai rubare lo spazio
      ai tuoi dati: se non ci sta, l'app lo dice e non lo tiene.)

### Prezzi da un elenco JSON

- [ ] Incollando `{"nome":"Klara Bühl","prezzo":"8.2K"}` — anche senza
      parentesi quadre — l'anteprima mostra la carta con 8.200.
- [ ] Il pulsante dice quante carte sta per aggiornare e quante ne creerà;
      applicandolo, compaiono nel pannello con «poco fa».
- [ ] Righe senza nome o senza prezzo vengono **contate come scartate**, non
      ignorate in silenzio; i doppioni entrano una volta sola.
- [ ] Un testo che non è JSON dice cosa non va, invece di non fare niente.
- [ ] Una carta creata senza valutazione mostra «valutazione mancante» nella
      sua scheda: scrivendola, resta la stessa carta (non se ne crea un'altra).
- [ ] Un elenco di un centinaio di carte si applica in un paio di secondi
      senza bloccare la pagina.

### Prezzo stimato

Il seguito naturale dei prezzi scritti a mano: quello che hai segnato
invecchia, e l'app dice quanto dovrebbe costare adesso.

- [ ] Sotto al prezzo di una carta per cui hai scritto una cifra compare
      **PREZZO STIMATO ORA** con accanto l'affidabilità (*alta*, *media*,
      *bassa*, *molto bassa*) e la frase che spiega da dove nasce il numero.
- [ ] La frase dice da quanto tempo parte: «segnato 2 giorni fa» se hai
      scritto quel prezzo l'altro ieri, non «segnato poco fa».
- [ ] Sotto ci sono i due momenti utili della settimana: uno **▼ atteso più
      basso** (quando comprare) e uno **▲ atteso più alto** (quando vendere),
      con giorno, ora e variazione attesa.
- [ ] Su una carta di cui non hai mai segnato un prezzo e senza storico la
      stima **non** compare: senza dati non si inventa niente.
- [ ] La stessa stima compare sulle carte della rosa in *Conti*.
- [ ] La stima non si allontana mai più del 25% dal prezzo che hai segnato,
      per quanto vecchio sia.

### Conti (la tua rosa)

- [ ] Incolla nel riquadro «Importa la rosa»:
      ```
      Lautaro Martinez x2 150k
      Bastoni 44000
      Rafael Leao, 1, 58000
      ```
- [ ] L'anteprima sotto il pulsante legge tre carte con le quantità giuste.
- [ ] Dopo l'importazione ogni carta ha un verdetto (`tieni`, `vendi presto`,
      `vendi ora`, `aspetta`) con i motivi, e il ROI attuale.
- [ ] «Chiudi trade» sposta la carta fra i trade chiusi con il profitto netto.
- [ ] «Esporta CSV» scarica il file e si apre in Excel o Fogli Google.

### Watchlist e Avvisi

- [ ] Metti un target di acquisto **sopra** il prezzo attuale di una carta che
      segui: il segnale diventa «compra ora».
- [ ] La campanella in alto mostra il contatore, e la pagina Avvisi elenca
      l'avviso corrispondente.
- [ ] «Consenti notifiche» chiede il permesso al browser; concedendolo, i
      prossimi avvisi importanti arrivano anche come notifica di sistema
      (solo mentre l'app è aperta, anche in secondo piano).

### Opzioni

- [ ] Cambia il margine obiettivo da 15% a 25%: i prezzi di acquisto
      consigliati in Occasioni si abbassano.
- [ ] «Esporta backup» scarica un JSON; «Azzera tutto» svuota; «Importa
      backup» rimette tutto com'era.

---

## 5. Dal telefono, sulla rete di casa

Sul computer, al posto di `npm run dev`:

```bash
npm run mobile
```

Il comando stampa l'indirizzo da digitare sul telefono, del tipo
`http://192.168.1.42:8787`. Telefono e computer devono essere sulla stessa
Wi-Fi.

- [ ] L'app si apre sul telefono con la barra di navigazione in basso.
- [ ] Dal menu del browser: «Installa app» (Android) o Condividi → «Aggiungi a
      Home» (iPhone). Compare l'icona e si apre a schermo intero.
- [ ] **Prova senza rete:** metti il telefono in modalità aereo e riapri
      l'app. Deve aprirsi lo stesso, mostrare i prezzi salvati con
      l'etichetta **OFFLINE** e la scritta «prezzi salvati in memoria, non
      aggiornati». Calcoli, rosa e watchlist devono funzionare normalmente.

Se il telefono non apre l'indirizzo, quasi sempre è il firewall del computer:
autorizza Node sulla rete privata quando Windows o macOS lo chiede.

---

## 6. La versione pubblicata su GitHub Pages

<https://capozzoligiofra.github.io/CompravenditaFc27/>

- [ ] Si apre e mostra il badge `prezzi vostri` (là il proxy non esiste: è
      previsto).
- [ ] **Pagina bianca?** Allora Pages sta pubblicando i sorgenti invece della
      build: *Settings → Pages → Source* va messo su **GitHub Actions**, poi
      ricarica con Ctrl+Shift+R. Conferma del problema: nella scheda Actions
      compaiono due processi a ogni push e «pages build and deployment»
      finisce dopo «Pubblica su GitHub Pages».
- [ ] Calcoli, watchlist, rosa e avvisi funzionano.
- [ ] Si installa sul telefono come la versione locale.

---

## 7. Il listino condiviso

Da fare dopo aver caricato `server-php/` su Aruba (istruzioni in
`server-php/LEGGIMI.md`). Serve un secondo dispositivo, o anche solo una
finestra anonima: per l'app è un altro dispositivo a tutti gli effetti.

- [ ] `https://iltuosito.it/fc27/api.php?azione=salute` aperto nel browser
      risponde con una riga che comincia per `{"ok":true`.
- [ ] *Opzioni → Listino condiviso*: incolli l'indirizzo, scrivi il tuo nome,
      premi Collegati. Compare **COLLEGATO come <nome>** e, in alto accanto al
      logo, la scritta **LISTINO IN COMUNE**.
- [ ] Segni un prezzo dalla pagina *Prezzi*. Dopo qualche secondo, in Opzioni
      il conteggio «sul server» sale.
- [ ] Sul secondo dispositivo ti colleghi con un **nome diverso**: i prezzi
      sono già lì, con scritto **da <il tuo nome>**.
- [ ] Dal secondo dispositivo correggi un prezzo; torni sul primo e, dopo una
      sincronizzazione (o premendo «Sincronizza ora»), il prezzo è quello
      nuovo, con l'altro nome accanto.
- [ ] **Stesso nome, due dispositivi**: la rosa e la watchlist del primo
      compaiono sul secondo. Il telefono nuovo **riceve** la rosa, non la
      cancella.
- [ ] **Senza rete**: metti il telefono in aereo, segni un prezzo (si salva lo
      stesso, l'indicatore diventa giallo), riattivi la rete e dopo qualche
      secondo il prezzo è sul server.
- [ ] Cambiando piattaforma (PS → Xbox) il listino si ricarica per quella
      piattaforma: non restano i prezzi PlayStation.
- [ ] Le **carte seguite restano personali**: sul secondo dispositivo, con un
      nome diverso, l'elenco «Tutte le mie» è vuoto e le carte dell'altro
      stanno in «Dal listino». Aprendone una, passa fra le proprie.
- [ ] **Invito**: *Opzioni → Invita qualcuno* copia (o condivide) un link.
      Aprendolo su un dispositivo nuovo compare «Ti hanno invitato a un
      listino» con l'indirizzo in chiaro; si scrive solo il nome e si entra.
- [ ] Subito dopo, il dispositivo nuovo trova nella pagina *Prezzi* le carte
      del listino con i prezzi già segnati dagli altri, pur non avendo né
      rosa né watchlist.
- [ ] Un link d'invito senza indirizzo (`#/entra` da solo) non rompe niente:
      porta alle Opzioni.

---

## 8. Prima di condividerla

Da fare in una **finestra anonima**, che è quello che vede chi riceve il link.

- [ ] Si apre la scheda **«Benvenuto: cos'è questa app»** con le tre righe di
      spiegazione, e i pulsanti «Inizia dai prezzi» e «Ho capito».
- [ ] «Inizia dai prezzi» porta al pannello; ricaricando, il benvenuto non
      ricompare.
- [ ] Nessun tuo dato è visibile: rosa e watchlist sono vuote.
- [ ] *Opzioni → Condividi l'app*: il pulsante apre la condivisione del
      telefono, o copia l'indirizzo sul computer.
- [ ] Incollando il link in una chat compare l'anteprima con il titolo e
      l'immagine (se resta grigia, il servizio di messaggistica ha in cache la
      versione vecchia: aspetta qualche ora o aggiungi `?v=2` in fondo).

---

## Se qualcosa non va

Mandami:

1. l'output completo di `npm run diagnosi`;
2. il comando che stavi eseguendo e l'errore a schermo;
3. per problemi nell'interfaccia, cosa ti aspettavi e cosa è successo (una
   foto dello schermo va benissimo);
4. se il browser mostra una pagina bianca: apri la console (F12 → Console) e
   copia le righe rosse.
