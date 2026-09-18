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

## Se qualcosa non va

Mandami:

1. l'output completo di `npm run diagnosi`;
2. il comando che stavi eseguendo e l'errore a schermo;
3. per problemi nell'interfaccia, cosa ti aspettavi e cosa è successo (una
   foto dello schermo va benissimo);
4. se il browser mostra una pagina bianca: apri la console (F12 → Console) e
   copia le righe rosse.
