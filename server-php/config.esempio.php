<?php
// Copia questo file in "config.php" e riempilo con i dati del tuo database.
//
// Su Aruba li trovi nel pannello, sezione Database: quando ne crei uno MySQL
// ti dà nome del database, utente, password e host (di solito qualcosa come
// "nomedb.mysql.web.aruba.it", NON "localhost").
//
// config.php non va messo su GitHub: contiene la password.

return [
    'host' => 'nomedb.mysql.web.aruba.it',
    'database' => 'nomedb',
    'utente' => 'nomedb',
    'password' => 'la-password-del-database',

    // Da quali indirizzi l'app può chiamare questo servizio. '*' va bene per
    // iniziare; quando l'indirizzo pubblico è definitivo, mettilo qui e
    // diventa l'unico autorizzato.
    //   'origini' => ['https://capozzoligiofra.github.io'],
    'origini' => ['*'],

    // Quante carte tenere nel listino: oltre questo numero si buttano le
    // meno aggiornate. 0 = nessun limite.
    'massimo_carte' => 5000,

    // --- Sorgente automatica dei prezzi --------------------------------
    //
    // Se nel database hai gia' delle tabelle con i prezzi aggiornati, l'app
    // le legge da sola a ogni sincronizzazione. Non ci scrive mai dentro: le
    // riempie il tuo programma, e restano come stanno.
    //
    // I nomi delle colonne il server prova a riconoscerli da solo (nome,
    // name, player_name; prezzo, price, lowest_bin; e cosi' via). Se le tue
    // si chiamano in modo che nessun elenco poteva prevedere, scrivile qui
    // sotto: quello che metti qui vince sempre.
    //
    // Per vedere cosa ha riconosciuto: apri
    // https://iltuosito.it/fc27/api.php?azione=sorgente — oppure guarda il
    // pannello «Sorgente automatica» nella pagina Prezzi dell'app.

    'sorgente_attiva' => true,
    'sorgente_tabella_prezzi' => 'futbin_giocatori_gold',
    'sorgente_tabella_storico' => 'futbin_storico_gold',

    // Lascia vuoti per il riconoscimento automatico. «nome» e «prezzo» sono
    // gli unici indispensabili; «valutazione» serve a distinguere due carte
    // con lo stesso nome, e senza di lei quei casi vengono saltati invece di
    // tirare a indovinare.
    //   'sorgente_colonne_prezzi' => [
    //       'nome' => 'player_name',
    //       'valutazione' => 'overall_rating',
    //       'prezzo' => 'ps_lowest_bin',
    //       'aggiornato' => 'scraped_at',
    //       'piattaforma' => 'platform',
    //   ],
    'sorgente_colonne_prezzi' => [],

    //   'sorgente_colonne_storico' => ['nome' => 'player_name', 'prezzo' => 'price', 'giorno' => 'snapshot_date'],
    'sorgente_colonne_storico' => [],
];
