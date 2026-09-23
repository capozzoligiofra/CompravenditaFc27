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
| `403` / `503` | Futbin blocca le richieste automatiche | riprova più tardi; se persiste, l'app resta utile in modalità demo |
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

## 4. L'app sul computer

```bash
npm run dev
```

Apri <http://localhost:5173>. In alto a destra c'è il badge della sorgente:
`Futbin FC27` in verde se il passo 3 è andato bene, `dati demo` in giallo
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

Serve quando Futbin risponde `403` (succede spesso) e i prezzi restano demo.

- [ ] Nella scheda di un giocatore scrivi una cifra in «Prezzo visto in gioco»
      e premi Salva: il prezzo in alto diventa quello, con scritto «inserito
      da te», e il piano di trade si ricalcola su quella cifra.
- [ ] Lo stesso prezzo compare in Watchlist e nei verdetti della rosa.
- [ ] In *Conti* → «Aggiorna i prezzi in blocco» incolla
      `Lautaro Martinez 175000` e `Tizio Inesistente 9000`: il primo viene
      aggiornato, il secondo **deve** finire fra i «non trovati» e non essere
      assegnato a nessuno.
- [ ] Riaprendo l'app il giorno dopo, il grafico di una carta mostra un
      secondo punto: l'app si costruisce lo storico da sola.

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

- [ ] Si apre e mostra il badge `dati demo` (là il proxy non esiste: è
      previsto).
- [ ] **Pagina bianca?** Allora Pages sta pubblicando i sorgenti invece della
      build: *Settings → Pages → Source* va messo su **GitHub Actions**, poi
      ricarica con Ctrl+Shift+R. Conferma del problema: nella scheda Actions
      compaiono due processi a ogni push e «pages build and deployment»
      finisce dopo «Pubblica su GitHub Pages».
- [ ] Calcoli, watchlist, rosa e avvisi funzionano.
- [ ] Si installa sul telefono come la versione locale.

---

## 7. Prima di condividerla

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
