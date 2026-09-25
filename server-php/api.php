<?php
// Il listino condiviso: un servizio piccolo, che sta su un hosting Linux
// qualsiasi (PHP + MySQL) e non chiede altro.
//
// Fa tre cose e basta:
//   1. tiene un prezzo per carta, uguale per tutti quelli che usano l'app;
//   2. conserva i dati personali di ciascuno (rosa, watchlist), che in comune
//      non vanno;
//   3. dice cosa è cambiato da un certo momento in poi, così il telefono
//      scarica il poco che gli manca invece di tutto il listino.
//
// Gli «account» sono simbolici, come da richiesta: si scrive un nome, si
// riceve un token, e quel token serve solo a firmare i prezzi e a ritrovare i
// propri dati. Non è una password e non protegge niente: chi conosce
// l'indirizzo può scrivere. È una scelta, non una svista — sta scritto anche
// nell'app.
//
// Chiamate (tutte su questo file):
//   GET  api.php?azione=salute
//   GET  api.php?azione=diagnostica   cosa manca all'installazione
//   POST api.php?azione=entra          {nome}
//   GET  api.php?azione=prezzi&piattaforma=ps&da=0
//   POST api.php?azione=prezzi         {piattaforma, prezzi:[{id,price,at,giocatore}]}
//   GET  api.php?azione=catalogo            stato del catalogo condiviso
//   GET  api.php?azione=catalogo&blocco=0    un blocco di carte
//   POST api.php?azione=catalogo             {versione, indice, blocchi, carte:[...]}
//   GET  api.php?azione=cerca&q=lautaro
//   POST api.php?azione=carta          {giocatore:{name,rating,...}}
//   GET  api.php?azione=storico&id=123&piattaforma=ps
//   GET  api.php?azione=dati
//   POST api.php?azione=dati           {contenuto, aggiornato}
//   GET  api.php?azione=chi

declare(strict_types=1);

const GIORNO_MS = 86400000;
const MAX_PREZZI_PER_CHIAMATA = 300;
const MAX_CORPO_BYTE = 2097152; // 2 MB: la rosa più lunga sta in molto meno

$config = file_exists(__DIR__ . '/config.php')
    ? require __DIR__ . '/config.php'
    : null;

// --- Intestazioni ------------------------------------------------------

$origine = $_SERVER['HTTP_ORIGIN'] ?? '';
$consentite = $config['origini'] ?? ['*'];
if (in_array('*', $consentite, true)) {
    header('Access-Control-Allow-Origin: *');
} elseif ($origine !== '' && in_array($origine, $consentite, true)) {
    header('Access-Control-Allow-Origin: ' . $origine);
    header('Vary: Origin');
}
header('Access-Control-Allow-Headers: content-type, x-fc27-token');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// --- Utilità -----------------------------------------------------------

function rispondi(array $dati, int $codice = 200): void
{
    http_response_code($codice);
    echo json_encode($dati, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function errore(string $messaggio, int $codice = 400): void
{
    rispondi(['errore' => $messaggio], $codice);
}

function corpo(): array
{
    $grezzo = file_get_contents('php://input', false, null, 0, MAX_CORPO_BYTE + 1);
    if ($grezzo === false || $grezzo === '') {
        return [];
    }
    if (strlen($grezzo) > MAX_CORPO_BYTE) {
        errore('Richiesta troppo grande.', 413);
    }
    $dati = json_decode($grezzo, true);
    return is_array($dati) ? $dati : [];
}

/** Gli identificativi delle carte vengono da fuori: si accettano solo quelli semplici. */
function idValido($valore): ?string
{
    $id = is_scalar($valore) ? trim((string) $valore) : '';
    return preg_match('/^[A-Za-z0-9_-]{1,32}$/', $id) === 1 ? $id : null;
}

function piattaformaValida($valore): string
{
    $piattaforma = is_scalar($valore) ? strtolower(trim((string) $valore)) : '';
    return in_array($piattaforma, ['ps', 'xbox', 'pc'], true) ? $piattaforma : 'ps';
}

function adesso(): int
{
    return (int) round(microtime(true) * 1000);
}

/** Il nome serve per riconoscersi, non per autenticarsi: si ripulisce e basta. */
function normalizzaNome(string $nome): string
{
    $pulito = preg_replace('/\s+/u', ' ', trim($nome));
    return mb_substr((string) $pulito, 0, 40);
}

function chiaveNome(string $nome): string
{
    $minuscolo = mb_strtolower($nome, 'UTF-8');
    $senzaAccenti = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $minuscolo);
    $solo = preg_replace('/[^a-z0-9]+/', '', $senzaAccenti === false ? $minuscolo : $senzaAccenti);
    return (string) $solo;
}

// --- Database ----------------------------------------------------------

if (!is_array($config)) {
    errore("Manca config.php: copia config.esempio.php e mettici i dati del database.", 500);
}

try {
    $db = new PDO(
        sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', $config['host'], $config['database']),
        $config['utente'],
        $config['password'],
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]
    );
} catch (Throwable $errore) {
    // Il messaggio del driver può contenere host e utente: non esce di qui.
    error_log('[fc27] database non raggiungibile: ' . $errore->getMessage());
    errore('Database non raggiungibile. Controlla config.php.', 503);
}

/** Il dispositivo che sta chiamando, se ha già fatto «entra». */
function utenteCorrente(PDO $db): ?array
{
    $token = $_SERVER['HTTP_X_FC27_TOKEN'] ?? '';
    if (!is_string($token) || preg_match('/^[a-f0-9]{32}$/', $token) !== 1) {
        return null;
    }
    $query = $db->prepare(
        'select u.id, u.nome, s.token from sessioni s join utenti u on u.id = s.utente where s.token = ?'
    );
    $query->execute([$token]);
    $riga = $query->fetch();
    if (!$riga) {
        return null;
    }
    $tocca = $db->prepare('update sessioni set visto = ? where token = ?');
    $tocca->execute([adesso(), $token]);
    return ['id' => (int) $riga['id'], 'nome' => (string) $riga['nome'], 'token' => $token];
}

function richiediUtente(PDO $db): array
{
    $utente = utenteCorrente($db);
    if ($utente === null) {
        errore("Non riconosciuto: rientra con il tuo nome dall'app.", 401);
    }
    return $utente;
}

/**
 * Scrive un blocco di carte nella tabella dei giocatori.
 *
 * Le righe arrivano nella forma compatta [id, nome, voto, ruolo, club, lega,
 * nazione, ...]. Si inseriscono a gruppi: una sola istruzione da duemila
 * righe supererebbe i limiti di tanti hosting, duemila istruzioni separate ci
 * metterebbero un minuto.
 */
function scriviGiocatori(PDO $db, array $carte, int $ora): int
{
    $gruppi = array_chunk($carte, 200);
    $scritte = 0;
    $db->beginTransaction();
    foreach ($gruppi as $gruppo) {
        $valori = [];
        $parametri = [];
        foreach ($gruppo as $riga) {
            if (!is_array($riga) || count($riga) < 2) {
                continue;
            }
            $id = idValido($riga[0] ?? null);
            $nome = is_scalar($riga[1] ?? null) ? trim((string) $riga[1]) : '';
            if ($id === null || $nome === '') {
                continue;
            }
            $valori[] = '(?, ?, ?, ?, ?, ?, ?, ?, ?)';
            array_push(
                $parametri,
                $id,
                mb_substr($nome, 0, 120),
                (int) ($riga[2] ?? 0),
                mb_substr((string) ($riga[3] ?? ''), 0, 12),
                mb_substr((string) ($riga[4] ?? ''), 0, 80),
                mb_substr((string) ($riga[5] ?? ''), 0, 80),
                mb_substr((string) ($riga[6] ?? ''), 0, 80),
                '',
                $ora
            );
            $scritte++;
        }
        if (count($valori) === 0) {
            continue;
        }
        $db->prepare(
            'insert into giocatori (id, nome, valutazione, ruolo, club, lega, nazione, versione, aggiornato)
             values ' . implode(',', $valori) . '
             on duplicate key update
               nome = values(nome), valutazione = values(valutazione), ruolo = values(ruolo),
               club = values(club), lega = values(lega), nazione = values(nazione),
               aggiornato = values(aggiornato)'
        )->execute($parametri);
    }
    $db->commit();
    return $scritte;
}

// --- Azioni ------------------------------------------------------------

$azione = $_GET['azione'] ?? 'salute';
$metodo = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    switch ($azione) {
        case 'salute':
            $conti = $db->query(
                'select (select count(*) from prezzi) as prezzi,
                        (select count(*) from utenti) as utenti,
                        (select count(*) from storico) as punti,
                        (select coalesce(max(aggiornato), 0) from prezzi) as ultimo'
            )->fetch();
            rispondi([
                'ok' => true,
                'servizio' => 'listino condiviso FC27 Trader',
                'versione' => 1,
                'adesso' => adesso(),
                'prezzi' => (int) $conti['prezzi'],
                'utenti' => (int) $conti['utenti'],
                'puntiStorico' => (int) $conti['punti'],
                'ultimoAggiornamento' => (int) $conti['ultimo'],
            ]);
            // no break: rispondi() termina

        case 'diagnostica':
            // A che punto e' l'installazione: versioni e tabelle presenti.
            // Serve a rispondere in dieci secondi alla domanda «perche' non
            // funziona», invece di indovinare a distanza.
            $attese = ['utenti', 'sessioni', 'giocatori', 'prezzi', 'storico', 'dati_utente', 'catalogo', 'catalogo_stato'];
            $presenti = [];
            foreach ($db->query('show tables')->fetchAll(PDO::FETCH_NUM) as $riga) {
                $presenti[] = (string) $riga[0];
            }
            $mancanti = array_values(array_diff($attese, $presenti));
            $giocatori = in_array('giocatori', $presenti, true)
                ? (int) $db->query('select count(*) as n from giocatori')->fetch()['n']
                : 0;
            rispondi([
                'php' => PHP_VERSION,
                'database' => $db->getAttribute(PDO::ATTR_SERVER_VERSION),
                'giocatori' => $giocatori,
                'tabelle' => count($presenti),
                'mancanti' => $mancanti,
                'pronto' => count($mancanti) === 0,
                'limiteCorpo' => ini_get('post_max_size'),
            ]);

        case 'entra':
            if ($metodo !== 'POST') {
                errore('Serve una POST.', 405);
            }
            $dati = corpo();
            $nome = normalizzaNome(is_scalar($dati['nome'] ?? '') ? (string) $dati['nome'] : '');
            $chiave = chiaveNome($nome);
            if ($nome === '' || $chiave === '') {
                errore('Scrivi un nome con almeno una lettera o un numero.');
            }

            $cerca = $db->prepare('select id, nome from utenti where nome_norm = ?');
            $cerca->execute([$chiave]);
            $utente = $cerca->fetch();

            $ora = adesso();
            if ($utente) {
                $id = (int) $utente['id'];
                $db->prepare('update utenti set nome = ?, visto = ? where id = ?')->execute([$nome, $ora, $id]);
            } else {
                $db->prepare('insert into utenti (nome, nome_norm, creato, visto) values (?, ?, ?, ?)')
                    ->execute([$nome, $chiave, $ora, $ora]);
                $id = (int) $db->lastInsertId();
            }

            $token = bin2hex(random_bytes(16));
            $db->prepare('insert into sessioni (token, utente, creato, visto) values (?, ?, ?, ?)')
                ->execute([$token, $id, $ora, $ora]);

            rispondi(['token' => $token, 'utente' => ['id' => $id, 'nome' => $nome], 'adesso' => $ora]);

        case 'prezzi':
            if ($metodo === 'GET') {
                $piattaforma = piattaformaValida($_GET['piattaforma'] ?? 'ps');
                $da = max(0, (int) ($_GET['da'] ?? 0));
                $query = $db->prepare(
                    'select p.id, p.prezzo, p.osservato, p.aggiornato, u.nome as autore,
                            g.nome as carta, g.valutazione
                     from prezzi p
                     left join utenti u on u.id = p.autore
                     left join giocatori g on g.id = p.id
                     where p.piattaforma = ? and p.aggiornato > ?
                     order by p.aggiornato asc
                     limit 2000'
                );
                $query->execute([$piattaforma, $da]);
                $prezzi = [];
                foreach ($query->fetchAll() as $riga) {
                    $prezzi[] = [
                        'id' => (string) $riga['id'],
                        'price' => (int) $riga['prezzo'],
                        'at' => (int) $riga['osservato'],
                        'aggiornato' => (int) $riga['aggiornato'],
                        'autore' => (string) ($riga['autore'] ?? ''),
                        'carta' => (string) ($riga['carta'] ?? ''),
                        'valutazione' => (int) ($riga['valutazione'] ?? 0),
                    ];
                }
                // «adesso» è l'orologio del server: il telefono se lo tiene e
                // lo rimanda come «da», così non serve che i due orologi
                // vadano d'accordo.
                rispondi(['piattaforma' => $piattaforma, 'adesso' => adesso(), 'prezzi' => $prezzi]);
            }

            if ($metodo !== 'POST') {
                errore('Serve una GET o una POST.', 405);
            }

            $utente = richiediUtente($db);
            $dati = corpo();
            $piattaforma = piattaformaValida($dati['piattaforma'] ?? 'ps');
            $elenco = is_array($dati['prezzi'] ?? null) ? $dati['prezzi'] : [];
            if (count($elenco) > MAX_PREZZI_PER_CHIAMATA) {
                $elenco = array_slice($elenco, 0, MAX_PREZZI_PER_CHIAMATA);
            }

            $ora = adesso();
            // Un prezzo vince su quello in archivio solo se è stato visto dopo:
            // è la stessa regola che applica l'app, e vale nei due sensi.
            $scrivi = $db->prepare(
                'insert into prezzi (id, piattaforma, prezzo, osservato, aggiornato, autore)
                 values (?, ?, ?, ?, ?, ?)
                 on duplicate key update
                   prezzo = if(values(osservato) >= prezzi.osservato, values(prezzo), prezzi.prezzo),
                   autore = if(values(osservato) >= prezzi.osservato, values(autore), prezzi.autore),
                   aggiornato = if(values(osservato) >= prezzi.osservato, values(aggiornato), prezzi.aggiornato),
                   osservato = greatest(prezzi.osservato, values(osservato))'
            );
            $scriviStorico = $db->prepare(
                'insert into storico (id, piattaforma, giorno, prezzo) values (?, ?, ?, ?)
                 on duplicate key update prezzo = values(prezzo)'
            );
            $scriviCarta = $db->prepare(
                'insert into giocatori (id, nome, valutazione, ruolo, club, lega, nazione, versione, aggiornato)
                 values (?, ?, ?, ?, ?, ?, ?, ?, ?)
                 on duplicate key update
                   nome = values(nome), valutazione = values(valutazione), ruolo = values(ruolo),
                   club = values(club), lega = values(lega), nazione = values(nazione),
                   versione = values(versione), aggiornato = values(aggiornato)'
            );

            $salvati = 0;
            $db->beginTransaction();
            foreach ($elenco as $voce) {
                if (!is_array($voce)) {
                    continue;
                }
                $id = idValido($voce['id'] ?? null);
                $prezzo = (int) round((float) ($voce['price'] ?? 0));
                if ($id === null || $prezzo <= 0 || $prezzo > 100000000) {
                    continue;
                }
                // Un'osservazione datata nel futuro vincerebbe per sempre.
                $osservato = (int) ($voce['at'] ?? 0);
                if ($osservato <= 0 || $osservato > $ora + 5 * 60000) {
                    $osservato = $ora;
                }
                $scrivi->execute([$id, $piattaforma, $prezzo, $osservato, $ora, $utente['id']]);
                $scriviStorico->execute([$id, $piattaforma, intdiv($osservato, GIORNO_MS), $prezzo]);

                $carta = is_array($voce['giocatore'] ?? null) ? $voce['giocatore'] : null;
                if ($carta !== null && is_scalar($carta['name'] ?? null)) {
                    $scriviCarta->execute([
                        $id,
                        mb_substr((string) $carta['name'], 0, 120),
                        (int) ($carta['rating'] ?? 0),
                        mb_substr((string) ($carta['position'] ?? ''), 0, 12),
                        mb_substr((string) ($carta['club'] ?? ''), 0, 80),
                        mb_substr((string) ($carta['league'] ?? ''), 0, 80),
                        mb_substr((string) ($carta['nation'] ?? ''), 0, 80),
                        mb_substr((string) ($carta['version'] ?? ''), 0, 60),
                        $ora,
                    ]);
                }
                $salvati++;
            }
            $db->commit();

            $massimo = (int) ($GLOBALS['config']['massimo_carte'] ?? 0);
            if ($massimo > 0 && random_int(1, 50) === 1) {
                // Ogni tanto si fa spazio, buttando le carte più trascurate.
                $db->prepare(
                    'delete from prezzi where piattaforma = ? and id not in (
                       select id from (
                         select id from prezzi where piattaforma = ? order by aggiornato desc limit ' . $massimo . '
                       ) as tenute
                     )'
                )->execute([$piattaforma, $piattaforma]);
            }

            rispondi(['salvati' => $salvati, 'adesso' => $ora]);

        case 'catalogo':
            // L'elenco dei giocatori, caricato una volta e scaricato da tutti.
            // Viaggia a blocchi: ventimila carte non stanno in una richiesta.
            if ($metodo === 'GET') {
                $stato = $db->query('select versione, blocchi, carte, aggiornato from catalogo_stato where id = 1')->fetch();
                if (!$stato) {
                    rispondi(['versione' => 0, 'blocchi' => 0, 'carte' => 0, 'aggiornato' => 0]);
                }
                if (isset($_GET['blocco'])) {
                    $indice = max(0, (int) $_GET['blocco']);
                    $query = $db->prepare('select contenuto from catalogo where versione = ? and indice = ?');
                    $query->execute([(int) $stato['versione'], $indice]);
                    $riga = $query->fetch();
                    if (!$riga) {
                        errore('Blocco non trovato.', 404);
                    }
                    rispondi([
                        'versione' => (int) $stato['versione'],
                        'indice' => $indice,
                        'carte' => json_decode((string) $riga['contenuto'], true) ?: [],
                    ]);
                }
                rispondi([
                    'versione' => (int) $stato['versione'],
                    'blocchi' => (int) $stato['blocchi'],
                    'carte' => (int) $stato['carte'],
                    'aggiornato' => (int) $stato['aggiornato'],
                ]);
            }

            if ($metodo !== 'POST') {
                errore('Serve una GET o una POST.', 405);
            }
            richiediUtente($db);
            $dati = corpo();
            $versione = (int) ($dati['versione'] ?? 0);
            $indice = (int) ($dati['indice'] ?? -1);
            $blocchi = (int) ($dati['blocchi'] ?? 0);
            $totale = (int) ($dati['totale'] ?? 0);
            $carte = is_array($dati['carte'] ?? null) ? $dati['carte'] : null;
            if ($versione <= 0 || $indice < 0 || $blocchi <= 0 || $indice >= $blocchi || $carte === null) {
                errore('Blocco di catalogo non valido.');
            }

            $ora = adesso();
            $db->prepare(
                'insert into catalogo (versione, indice, contenuto, aggiornato) values (?, ?, ?, ?)
                 on duplicate key update contenuto = values(contenuto), aggiornato = values(aggiornato)'
            )->execute([$versione, $indice, json_encode($carte, JSON_UNESCAPED_UNICODE), $ora]);

            // Il blocco serve ai dispositivi, che lo scaricano tal quale; ma
            // un blob JSON il database non sa leggerlo. Le stesse carte
            // finiscono quindi anche in «giocatori», riga per riga: e' quella
            // la tabella che risponde alle ricerche e che si puo' guardare.
            $scritte = scriviGiocatori($db, $carte, $ora);

            // Si contano le righe, non le carte dentro al JSON: json_length()
            // non esiste sui MySQL piu' vecchi, e un hosting condiviso puo'
            // benissimo averne uno. Il totale lo dichiara chi carica.
            $quanti = $db->prepare('select count(*) as n from catalogo where versione = ?');
            $quanti->execute([$versione]);
            $completo = ((int) $quanti->fetch()['n']) >= $blocchi;

            if ($completo) {
                // Solo adesso il catalogo nuovo diventa quello buono, e i
                // vecchi si buttano: nessuno deve scaricare una versione a metà.
                $db->prepare(
                    'insert into catalogo_stato (id, versione, blocchi, carte, aggiornato) values (1, ?, ?, ?, ?)
                     on duplicate key update versione = values(versione), blocchi = values(blocchi),
                       carte = values(carte), aggiornato = values(aggiornato)'
                )->execute([$versione, $blocchi, max(0, $totale), $ora]);
                $db->prepare('delete from catalogo where versione <> ?')->execute([$versione]);
            }

            rispondi([
                'versione' => $versione,
                'indice' => $indice,
                'completo' => $completo,
                'giocatori' => $scritte,
            ]);

        case 'unisci':
            // Due carte, lo stesso giocatore: succedeva prima che esistesse il
            // catalogo, quando un prezzo incollato per un nome sconosciuto
            // creava una carta senza valutazione. Adesso quella carta ha un
            // gemello con il voto giusto, e il prezzo va spostato li'.
            //
            // Si fa sul server, non solo nel telefono: altrimenti alla
            // sincronizzazione dopo il doppione tornerebbe giu' da solo, e
            // resterebbe anche a tutti gli altri.
            if ($metodo !== 'POST') {
                errore('Serve una POST.', 405);
            }
            richiediUtente($db);
            $dati = corpo();
            $coppie = is_array($dati['unioni'] ?? null) ? $dati['unioni'] : [];
            if (count($coppie) > 1000) {
                errore('Troppe unioni in una volta: mandane al massimo mille per richiesta.');
            }

            $ora = adesso();
            $unite = 0;
            $db->beginTransaction();

            // Il prezzo si sposta solo se e' piu' recente di quello che c'e'
            // gia' sulla carta buona: e' la stessa regola di tutto il resto
            // del listino, vince l'osservazione piu' fresca.
            $spostaPrezzo = $db->prepare(
                // La sorgente si chiama «vecchia»: senza un nome suo, il
                // database non saprebbe se «prezzi.osservato» nell'update
                // parla della riga che arriva o di quella che c'e' gia'.
                'insert into prezzi (id, piattaforma, prezzo, osservato, aggiornato, autore)
                 select ?, vecchia.piattaforma, vecchia.prezzo, vecchia.osservato, ?, vecchia.autore
                 from prezzi as vecchia where vecchia.id = ?
                 on duplicate key update
                   prezzo = if(values(osservato) > prezzi.osservato, values(prezzo), prezzi.prezzo),
                   autore = if(values(osservato) > prezzi.osservato, values(autore), prezzi.autore),
                   osservato = greatest(prezzi.osservato, values(osservato)),
                   aggiornato = values(aggiornato)'
            );
            // Nello storico c'e' un prezzo al giorno e non si sa a che ora:
            // dove i due si sovrappongono tiene quello della carta che resta.
            $spostaStorico = $db->prepare(
                'insert ignore into storico (id, piattaforma, giorno, prezzo)
                 select ?, vecchia.piattaforma, vecchia.giorno, vecchia.prezzo
                 from storico as vecchia where vecchia.id = ?'
            );
            $togliPrezzo = $db->prepare('delete from prezzi where id = ?');
            $togliStorico = $db->prepare('delete from storico where id = ?');
            $togliGiocatore = $db->prepare('delete from giocatori where id = ?');

            foreach ($coppie as $coppia) {
                if (!is_array($coppia)) {
                    continue;
                }
                $da = idValido($coppia['da'] ?? null);
                $a = idValido($coppia['a'] ?? null);
                if ($da === null || $a === null || $da === $a) {
                    continue;
                }
                $spostaPrezzo->execute([$a, $ora, $da]);
                $spostaStorico->execute([$a, $da]);
                $togliPrezzo->execute([$da]);
                $togliStorico->execute([$da]);
                $togliGiocatore->execute([$da]);
                $unite++;
            }

            $db->commit();
            rispondi(['unite' => $unite]);

        case 'cerca':
            // Il catalogo delle carte e' di tutti: chi ne crea una la rende
            // trovabile agli altri. Senza sorgenti esterne, questa e' la
            // ricerca dell'app.
            $testo = trim((string) ($_GET['q'] ?? ''));
            if (mb_strlen($testo) < 2) {
                rispondi(['giocatori' => []]);
            }
            $query = $db->prepare(
                'select g.id, g.nome, g.valutazione, g.ruolo, g.club, g.lega, g.nazione, g.versione
                 from giocatori g
                 where g.nome like ?
                 order by (g.nome like ?) desc, g.valutazione desc
                 limit 25'
            );
            $query->execute(['%' . $testo . '%', $testo . '%']);
            $giocatori = [];
            foreach ($query->fetchAll() as $riga) {
                $giocatori[] = [
                    'id' => (string) $riga['id'],
                    'name' => (string) $riga['nome'],
                    'rating' => (int) $riga['valutazione'],
                    'position' => (string) $riga['ruolo'],
                    'club' => (string) $riga['club'],
                    'league' => (string) $riga['lega'],
                    'nation' => (string) $riga['nazione'],
                    'version' => (string) $riga['versione'],
                ];
            }
            rispondi(['giocatori' => $giocatori]);

        case 'carta':
            // Una carta nuova entra nel catalogo anche prima di avere un
            // prezzo: chi la crea la sta gia' cercando, e gli altri devono
            // poterla trovare.
            if ($metodo !== 'POST') {
                errore('Serve una POST.', 405);
            }
            richiediUtente($db);
            $dati = corpo();
            $carta = is_array($dati['giocatore'] ?? null) ? $dati['giocatore'] : [];
            $id = idValido($carta['id'] ?? null);
            $nome = is_scalar($carta['name'] ?? null) ? trim((string) $carta['name']) : '';
            if ($id === null || $nome === '') {
                errore('Carta senza identificativo o senza nome.');
            }
            $db->prepare(
                'insert into giocatori (id, nome, valutazione, ruolo, club, lega, nazione, versione, aggiornato)
                 values (?, ?, ?, ?, ?, ?, ?, ?, ?)
                 on duplicate key update
                   nome = values(nome), valutazione = values(valutazione), ruolo = values(ruolo),
                   club = values(club), lega = values(lega), nazione = values(nazione),
                   versione = values(versione), aggiornato = values(aggiornato)'
            )->execute([
                $id,
                mb_substr($nome, 0, 120),
                (int) ($carta['rating'] ?? 0),
                mb_substr((string) ($carta['position'] ?? ''), 0, 12),
                mb_substr((string) ($carta['club'] ?? ''), 0, 80),
                mb_substr((string) ($carta['league'] ?? ''), 0, 80),
                mb_substr((string) ($carta['nation'] ?? ''), 0, 80),
                mb_substr((string) ($carta['version'] ?? ''), 0, 60),
                adesso(),
            ]);
            rispondi(['id' => $id, 'nome' => $nome]);

        case 'storico':
            $id = idValido($_GET['id'] ?? null);
            if ($id === null) {
                errore('Carta non valida.');
            }
            $piattaforma = piattaformaValida($_GET['piattaforma'] ?? 'ps');
            $query = $db->prepare(
                'select giorno, prezzo from storico where id = ? and piattaforma = ? order by giorno asc limit 120'
            );
            $query->execute([$id, $piattaforma]);
            $punti = [];
            foreach ($query->fetchAll() as $riga) {
                $punti[] = ['t' => ((int) $riga['giorno']) * GIORNO_MS, 'price' => (int) $riga['prezzo']];
            }
            rispondi(['id' => $id, 'piattaforma' => $piattaforma, 'punti' => $punti]);

        case 'dati':
            $utente = richiediUtente($db);
            if ($metodo === 'GET') {
                $query = $db->prepare('select contenuto, aggiornato from dati_utente where utente = ?');
                $query->execute([$utente['id']]);
                $riga = $query->fetch();
                rispondi([
                    'utente' => ['id' => $utente['id'], 'nome' => $utente['nome']],
                    'contenuto' => $riga ? json_decode((string) $riga['contenuto'], true) : null,
                    'aggiornato' => $riga ? (int) $riga['aggiornato'] : 0,
                ]);
            }
            if ($metodo !== 'POST') {
                errore('Serve una GET o una POST.', 405);
            }
            $dati = corpo();
            if (!isset($dati['contenuto']) || !is_array($dati['contenuto'])) {
                errore('Manca il contenuto da salvare.');
            }
            $quando = (int) ($dati['aggiornato'] ?? 0);
            if ($quando <= 0) {
                $quando = adesso();
            }
            // Vince la copia più recente: se hai salvato dal telefono mentre il
            // computer aveva una versione vecchia, il computer non la ributta giù.
            $db->prepare(
                'insert into dati_utente (utente, contenuto, aggiornato) values (?, ?, ?)
                 on duplicate key update
                   contenuto = if(values(aggiornato) >= dati_utente.aggiornato, values(contenuto), dati_utente.contenuto),
                   aggiornato = greatest(dati_utente.aggiornato, values(aggiornato))'
            )->execute([
                $utente['id'],
                json_encode($dati['contenuto'], JSON_UNESCAPED_UNICODE),
                $quando,
            ]);
            $query = $db->prepare('select aggiornato from dati_utente where utente = ?');
            $query->execute([$utente['id']]);
            rispondi(['aggiornato' => (int) ($query->fetch()['aggiornato'] ?? $quando)]);

        case 'chi':
            $query = $db->query(
                'select u.nome, u.visto, count(p.id) as prezzi
                 from utenti u left join prezzi p on p.autore = u.id
                 group by u.id, u.nome, u.visto
                 order by u.visto desc limit 50'
            );
            $persone = [];
            foreach ($query->fetchAll() as $riga) {
                $persone[] = [
                    'nome' => (string) $riga['nome'],
                    'visto' => (int) $riga['visto'],
                    'prezzi' => (int) $riga['prezzi'],
                ];
            }
            rispondi(['persone' => $persone]);

        default:
            errore('Azione sconosciuta.', 404);
    }
} catch (Throwable $problema) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    error_log('[fc27] ' . $problema->getMessage());

    // Il messaggio del driver puo' contenere pezzi di query: non esce di qui.
    // Escono il codice e, per i due inciampi tipici dell'installazione, la
    // frase che dice cosa fare — perche' «errore del servizio, riprova» non
    // ha mai aiutato nessuno a capire che mancava una tabella.
    $codice = $problema instanceof PDOException ? (string) ($problema->errorInfo[0] ?? '') : '';
    $testo = $problema->getMessage();
    if (str_contains($testo, 'catalogo') && (str_contains($testo, "doesn't exist") || str_contains($testo, 'not exist'))) {
        errore("Manca la tabella del catalogo: riesegui schema.sql da phpMyAdmin (azione: $azione).", 500);
    }
    if (stripos($testo, 'FUNCTION') !== false && stripos($testo, 'does not exist') !== false) {
        errore("Il database non ha una funzione che serve a questa versione del servizio: ricarica api.php aggiornato (azione: $azione).", 500);
    }
    errore("Errore del servizio nell'azione \"$azione\"" . ($codice !== '' ? " (codice $codice)" : '') . '.', 500);
}
