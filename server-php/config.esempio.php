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
];
