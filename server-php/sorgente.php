<?php
/**
 * La sorgente automatica: le tue tabelle dei prezzi, lette cosi' come sono.
 *
 * Se nel database ci sono gia' tabelle con i prezzi aggiornati e lo storico,
 * l'app puo' leggerle direttamente invece di farti reincollare le cifre a
 * mano. Questo file fa da traduttore fra quelle tabelle e il listino.
 *
 * Due regole guidano tutto il file.
 *
 * La prima: le tue tabelle non si toccano. Si leggono e basta — nessuna
 * scrittura, nessun alter, nessuna cancellazione. Le riempie il tuo
 * programma, e non deve trovarsele cambiate sotto i piedi.
 *
 * La seconda: i nomi delle colonne non si indovinano. Ogni database ha i
 * suoi, e scrivere «prezzo» sperando che sia quello e' il modo sicuro di far
 * fallire tutto in silenzio. Qui si guarda cosa c'e' davvero dentro la
 * tabella e si riconoscono le colonne per nome, con un elenco di forme
 * probabili; e se non bastasse, in config.php si possono scrivere esatte.
 */

/** Il nome ridotto all'osso, come lo riduce l'app: stessa regola, stesso risultato. */
function normalizzaNomeCarta(string $valore): string
{
    $testo = trim($valore);
    // FC27_SENZA_INTL serve alle prove: costringe a usare la via di riserva
    // anche dove intl c'e', perche' e' quella che girera' sugli hosting che
    // non ce l'hanno, ed e' quella che va verificata.
    if (class_exists('Normalizer') && !defined('FC27_SENZA_INTL')) {
        $testo = Normalizer::normalize($testo, Normalizer::FORM_D);
    }
    // Prima le minuscole, poi via i segni diacritici, poi la tabella. In
    // quest'ordine, perche' minuscolizzare la «I» turca maiuscola produce
    // una «i» seguita da un punto staccato, e quel punto va tolto dopo.
    $testo = mb_strtolower($testo, 'UTF-8');
    $testo = preg_replace('/\p{Mn}+/u', '', $testo);
    $testo = strtr($testo, ACCENTI);
    $testo = preg_replace('/[.\'`´’\-]/u', ' ', $testo);
    $testo = preg_replace('/\s+/u', ' ', $testo);
    return trim($testo);
}

/**
 * Le lettere accentate ridotte alla loro base, per quando intl non c'e'.
 *
 * Generata dalla stessa normalizzazione che usa l'app, non scritta a mano:
 * contiene solo i caratteri che si scompongono davvero in lettere ASCII.
 * «ı», «ø», «đ», «ł» non ci sono di proposito — non si scompongono, e l'app
 * li tratta come punteggiatura: tradurli qui darebbe un identificativo
 * diverso dal suo, e il prezzo non si attaccherebbe a nessuna carta.
 */
const ACCENTI = [
    'à'=>'a','á'=>'a','â'=>'a','ã'=>'a','ä'=>'a','å'=>'a','ç'=>'c','è'=>'e','é'=>'e','ê'=>'e',
    'ë'=>'e','ì'=>'i','í'=>'i','î'=>'i','ï'=>'i','ñ'=>'n','ò'=>'o','ó'=>'o','ô'=>'o','õ'=>'o',
    'ö'=>'o','ù'=>'u','ú'=>'u','û'=>'u','ü'=>'u','ý'=>'y','ÿ'=>'y','ā'=>'a','ă'=>'a','ą'=>'a',
    'ć'=>'c','ĉ'=>'c','ċ'=>'c','č'=>'c','ď'=>'d','ē'=>'e','ĕ'=>'e','ė'=>'e','ę'=>'e','ě'=>'e',
    'ĝ'=>'g','ğ'=>'g','ġ'=>'g','ģ'=>'g','ĥ'=>'h','ĩ'=>'i','ī'=>'i','ĭ'=>'i','į'=>'i','i̇'=>'i',
    'ĵ'=>'j','ķ'=>'k','ĺ'=>'l','ļ'=>'l','ľ'=>'l','ń'=>'n','ņ'=>'n','ň'=>'n','ō'=>'o','ŏ'=>'o',
    'ő'=>'o','ŕ'=>'r','ŗ'=>'r','ř'=>'r','ś'=>'s','ŝ'=>'s','ş'=>'s','š'=>'s','ţ'=>'t','ť'=>'t',
    'ũ'=>'u','ū'=>'u','ŭ'=>'u','ů'=>'u','ű'=>'u','ų'=>'u','ŵ'=>'w','ŷ'=>'y','ź'=>'z','ż'=>'z',
    'ž'=>'z','ơ'=>'o','ư'=>'u','ǎ'=>'a','ǐ'=>'i','ǒ'=>'o','ǔ'=>'u','ǖ'=>'u','ǘ'=>'u','ǚ'=>'u',
    'ǜ'=>'u','ǟ'=>'a','ǡ'=>'a','ǧ'=>'g','ǩ'=>'k','ǫ'=>'o','ǭ'=>'o','ǰ'=>'j','ǵ'=>'g','ǹ'=>'n',
    'ǻ'=>'a','ȁ'=>'a','ȃ'=>'a','ȅ'=>'e','ȇ'=>'e','ȉ'=>'i','ȋ'=>'i','ȍ'=>'o','ȏ'=>'o','ȑ'=>'r',
    'ȓ'=>'r','ȕ'=>'u','ȗ'=>'u','ș'=>'s','ț'=>'t','ȟ'=>'h','ȧ'=>'a','ȩ'=>'e','ȫ'=>'o','ȭ'=>'o',
    'ȯ'=>'o','ȱ'=>'o','ȳ'=>'y','ḁ'=>'a','ḃ'=>'b','ḅ'=>'b','ḇ'=>'b','ḉ'=>'c','ḋ'=>'d','ḍ'=>'d',
    'ḏ'=>'d','ḑ'=>'d','ḓ'=>'d','ḕ'=>'e','ḗ'=>'e','ḙ'=>'e','ḛ'=>'e','ḝ'=>'e','ḟ'=>'f','ḡ'=>'g',
    'ḣ'=>'h','ḥ'=>'h','ḧ'=>'h','ḩ'=>'h','ḫ'=>'h','ḭ'=>'i','ḯ'=>'i','ḱ'=>'k','ḳ'=>'k','ḵ'=>'k',
    'ḷ'=>'l','ḹ'=>'l','ḻ'=>'l','ḽ'=>'l','ḿ'=>'m','ṁ'=>'m','ṃ'=>'m','ṅ'=>'n','ṇ'=>'n','ṉ'=>'n',
    'ṋ'=>'n','ṍ'=>'o','ṏ'=>'o','ṑ'=>'o','ṓ'=>'o','ṕ'=>'p','ṗ'=>'p','ṙ'=>'r','ṛ'=>'r','ṝ'=>'r',
    'ṟ'=>'r','ṡ'=>'s','ṣ'=>'s','ṥ'=>'s','ṧ'=>'s','ṩ'=>'s','ṫ'=>'t','ṭ'=>'t','ṯ'=>'t','ṱ'=>'t',
    'ṳ'=>'u','ṵ'=>'u','ṷ'=>'u','ṹ'=>'u','ṻ'=>'u','ṽ'=>'v','ṿ'=>'v','ẁ'=>'w','ẃ'=>'w','ẅ'=>'w',
    'ẇ'=>'w','ẉ'=>'w','ẋ'=>'x','ẍ'=>'x','ẏ'=>'y','ẑ'=>'z','ẓ'=>'z','ẕ'=>'z','ẖ'=>'h','ẗ'=>'t',
    'ẘ'=>'w','ẙ'=>'y','ạ'=>'a','ả'=>'a','ấ'=>'a','ầ'=>'a','ẩ'=>'a','ẫ'=>'a','ậ'=>'a','ắ'=>'a',
    'ằ'=>'a','ẳ'=>'a','ẵ'=>'a','ặ'=>'a','ẹ'=>'e','ẻ'=>'e','ẽ'=>'e','ế'=>'e','ề'=>'e','ể'=>'e',
    'ễ'=>'e','ệ'=>'e','ỉ'=>'i','ị'=>'i','ọ'=>'o','ỏ'=>'o','ố'=>'o','ồ'=>'o','ổ'=>'o','ỗ'=>'o',
    'ộ'=>'o','ớ'=>'o','ờ'=>'o','ở'=>'o','ỡ'=>'o','ợ'=>'o','ụ'=>'u','ủ'=>'u','ứ'=>'u','ừ'=>'u',
    'ử'=>'u','ữ'=>'u','ự'=>'u','ỳ'=>'y','ỵ'=>'y','ỷ'=>'y','ỹ'=>'y',
];

/**
 * L'identificativo della carta, calcolato come lo calcola l'app.
 *
 * Deve venire identico, carattere per carattere: e' la chiave con cui il
 * prezzo si attacca alla carta giusta. Se qui uscisse anche solo
 * un'impronta diversa, i prezzi arriverebbero all'app senza agganciarsi a
 * nulla — visibili da nessuna parte, e senza un errore che lo dica.
 */
function idCartaDaNome(string $nome, int $valutazione = 0): string
{
    $pulito = preg_replace('/^-+|-+$/', '', preg_replace('/[^a-z0-9]+/', '-', normalizzaNomeCarta($nome)));
    if ($pulito === '') {
        return '';
    }
    $voto = max(0, min(99, $valutazione));

    // FNV-1a a 32 bit, come nell'app: un'impronta corta del nome intero, per
    // non far collidere due nomi che, tagliati a diciotto caratteri,
    // diventerebbero uguali.
    $testo = $pulito . '|' . $voto;
    $h = 0x811c9dc5;
    for ($i = 0, $n = strlen($testo); $i < $n; $i++) {
        $h ^= ord($testo[$i]);
        $h = ($h * 0x01000193) & 0xFFFFFFFF;
    }
    $impronta = substr(str_pad(base_convert((string) $h, 10, 36), 4, '0', STR_PAD_LEFT), -4);

    return substr('c-' . substr($pulito, 0, 18) . '-' . $voto . '-' . $impronta, 0, 32);
}

/** Le forme in cui una colonna puo' chiamarsi, in ordine di preferenza. */
const ALIAS_SORGENTE = [
    'nome' => ['nome', 'name', 'player_name', 'nome_giocatore', 'giocatore', 'common_name', 'player', 'nome_completo'],
    'valutazione' => ['valutazione', 'rating', 'overall', 'overall_rating', 'ovr', 'voto', 'media'],
    'prezzo' => ['prezzo', 'price', 'prezzo_attuale', 'current_price', 'lowest_bin', 'bin', 'valore', 'ps_price', 'prezzo_ps'],
    'aggiornato' => ['aggiornato', 'updated_at', 'ultimo_aggiornamento', 'aggiornamento', 'last_update', 'scraped_at', 'rilevato', 'timestamp', 'data_ora'],
    'piattaforma' => ['piattaforma', 'platform', 'console'],
    'giorno' => ['giorno', 'data', 'date', 'snapshot_date', 'giorno_data', 'data_rilevazione'],
    'carta' => ['id_carta', 'carta_id', 'giocatore_id', 'player_id', 'id_giocatore', 'resource_id', 'futbin_id'],
];

/**
 * Riconosce una colonna fra quelle che la tabella ha davvero.
 *
 * Prima la corrispondenza esatta, poi quella per contenuto: «prezzo_ps_bin»
 * vale come prezzo, ma solo se non c'e' una colonna che si chiama proprio
 * «prezzo». E' lo stesso criterio con cui l'app legge i CSV.
 */
function trovaColonnaSorgente(array $presenti, array $alias, array $occupate): ?string
{
    foreach ($alias as $cercato) {
        foreach ($presenti as $colonna) {
            if (strtolower($colonna) === $cercato && !in_array($colonna, $occupate, true)) {
                return $colonna;
            }
        }
    }
    foreach ($alias as $cercato) {
        foreach ($presenti as $colonna) {
            if (str_contains(strtolower($colonna), $cercato) && !in_array($colonna, $occupate, true)) {
                return $colonna;
            }
        }
    }
    return null;
}

/** Le colonne di una tabella, o null se la tabella non c'e'. */
function colonneDiTabella(PDO $db, string $tabella): ?array
{
    if (preg_match('/^[A-Za-z0-9_]{1,64}$/', $tabella) !== 1) {
        return null;
    }
    try {
        $query = $db->query('show columns from `' . $tabella . '`');
    } catch (PDOException $problema) {
        return null;
    }
    $colonne = [];
    foreach ($query->fetchAll() as $riga) {
        $colonne[] = (string) ($riga['Field'] ?? array_values($riga)[0]);
    }
    return $colonne;
}

/**
 * Cosa ha capito della tabella: quali colonne ha riconosciuto, quali no.
 *
 * `forzate` sono i nomi scritti a mano in config.php, e vincono sempre sul
 * riconoscimento automatico: sono l'ultima parola quando la tabella ha nomi
 * che nessun elenco di forme probabili poteva prevedere.
 */
function leggiColonneSorgente(PDO $db, string $tabella, array $volute, array $forzate = []): array
{
    $presenti = colonneDiTabella($db, $tabella);
    if ($presenti === null) {
        return ['tabella' => $tabella, 'esiste' => false, 'colonne' => [], 'trovate' => [], 'mancanti' => $volute];
    }
    $trovate = [];
    $occupate = [];
    foreach ($volute as $ruolo) {
        $forzata = $forzate[$ruolo] ?? null;
        if (is_string($forzata) && $forzata !== '') {
            // Una colonna scritta a mano che non esiste e' un errore da dire,
            // non da aggirare passando al riconoscimento automatico.
            $trovate[$ruolo] = in_array($forzata, $presenti, true) ? $forzata : null;
            if ($trovate[$ruolo] !== null) {
                $occupate[] = $forzata;
            }
            continue;
        }
        $colonna = trovaColonnaSorgente($presenti, ALIAS_SORGENTE[$ruolo] ?? [$ruolo], $occupate);
        $trovate[$ruolo] = $colonna;
        if ($colonna !== null) {
            $occupate[] = $colonna;
        }
    }
    return [
        'tabella' => $tabella,
        'esiste' => true,
        'colonne' => $presenti,
        'trovate' => $trovate,
        'mancanti' => array_values(array_keys(array_filter($trovate, static fn ($c) => $c === null))),
    ];
}

/** La configurazione della sorgente, con i valori predefiniti. */
function configurazioneSorgente(array $config): array
{
    return [
        'attiva' => (bool) ($config['sorgente_attiva'] ?? true),
        'prezzi' => (string) ($config['sorgente_tabella_prezzi'] ?? 'futbin_giocatori_gold'),
        'storico' => (string) ($config['sorgente_tabella_storico'] ?? 'futbin_storico_gold'),
        'colonne_prezzi' => (array) ($config['sorgente_colonne_prezzi'] ?? []),
        'colonne_storico' => (array) ($config['sorgente_colonne_storico'] ?? []),
        'massimo' => (int) ($config['sorgente_massimo'] ?? 60000),
    ];
}

const VOLUTE_PREZZI = ['nome', 'valutazione', 'prezzo', 'aggiornato', 'piattaforma'];
const VOLUTE_STORICO = ['nome', 'valutazione', 'prezzo', 'giorno', 'piattaforma'];

/** Le colonne indispensabili: senza queste non si puo' fare niente. */
const NECESSARIE_PREZZI = ['nome', 'prezzo'];
const NECESSARIE_STORICO = ['nome', 'prezzo', 'giorno'];

/**
 * Trasforma in millisecondi quello che c'e' nella colonna della data.
 *
 * Nelle tabelle vere questa colonna e' di tutto: un DATETIME, una data
 * scritta a mano, secondi dal 1970, millisecondi. Si accettano tutte invece
 * di pretendere un formato — e quando non si capisce si restituisce zero,
 * che vuol dire «non lo so», non «primo gennaio 1970».
 */
function quandoInMillisecondi($valore): int
{
    if ($valore === null || $valore === '') {
        return 0;
    }
    if (is_numeric($valore)) {
        $numero = (float) $valore;
        if ($numero <= 0) {
            return 0;
        }
        // Sotto i dieci miliardi sono secondi, sopra millisecondi: fra le due
        // scale ci sono tre ordini di grandezza, non si sbaglia.
        return (int) ($numero < 10_000_000_000 ? $numero * 1000 : $numero);
    }
    $tempo = strtotime((string) $valore);
    return $tempo === false ? 0 : $tempo * 1000;
}

/**
 * La stessa data, ma mai nel futuro.
 *
 * Una riga datata domani vincerebbe su qualunque altra osservazione per
 * sempre — la regola e' «vince la piu' recente» — e nessuno capirebbe perche'
 * quel prezzo non cambia mai. Succede senza malizia: basta che il programma
 * che riempie la tabella scriva l'ora locale e il database la legga come UTC,
 * e sono due ore di scarto. Un'osservazione non puo' essere piu' nuova di
 * adesso, quindi si riporta ad adesso.
 */
function quandoRagionevole($valore, int $ora): int
{
    $quando = quandoInMillisecondi($valore);
    if ($quando <= 0) {
        return 0;
    }
    return $quando > $ora ? $ora : $quando;
}

/** Il numero dentro «12.500», «12,5K», «1.2M», «985 000» o «12500». */
function prezzoInMonete($valore): int
{
    if (is_int($valore) || is_float($valore)) {
        return (int) round((float) $valore);
    }
    $testo = strtolower(trim((string) $valore));
    $testo = str_replace([' ', "\u{00a0}", "'"], '', $testo);
    if ($testo === '') {
        return 0;
    }

    $moltiplicatore = 1;
    if (str_ends_with($testo, 'k')) {
        $moltiplicatore = 1000;
        $testo = substr($testo, 0, -1);
    } elseif (str_ends_with($testo, 'm')) {
        $moltiplicatore = 1_000_000;
        $testo = substr($testo, 0, -1);
    }
    if ($moltiplicatore > 1) {
        // Con la sigla la virgola e' decimale: «1,2M» sono un milione e due.
        $testo = str_replace(',', '.', $testo);
        return is_numeric($testo) ? (int) round(((float) $testo) * $moltiplicatore) : 0;
    }

    // I separatori delle migliaia si riconoscono dalla forma — gruppi di
    // esattamente tre cifre — non dal simbolo, perche' il punto e la virgola
    // fanno quel mestiere in paesi diversi. Serve guardarla prima di dare il
    // numero da interpretare a PHP: per lui «985.000» vale novecentottantacinque.
    if (preg_match('/^\d{1,3}([.,]\d{3})+$/', $testo) === 1) {
        return (int) str_replace(['.', ','], '', $testo);
    }
    $testo = str_replace(',', '.', $testo);
    return is_numeric($testo) ? (int) round((float) $testo) : 0;
}

/**
 * Tutta la tabella dei prezzi, indicizzata per nome normalizzato.
 *
 * Si legge in blocco invece di interrogare il database una carta per volta:
 * ventimila righe costano una manciata di millisecondi una volta sola, mentre
 * cinquecento interrogazioni separate costerebbero molto di piu' e
 * pretenderebbero che il nome sul telefono fosse scritto esattamente come nel
 * database — che e' proprio quello che non succede mai.
 */
function indiceSorgente(PDO $db, array $mappa, string $tabella, int $massimo): array
{
    $ora = adesso();
    $c = $mappa['trovate'];
    $campi = [];
    foreach (['nome', 'valutazione', 'prezzo', 'aggiornato', 'piattaforma'] as $ruolo) {
        if (!empty($c[$ruolo])) {
            $campi[] = '`' . $c[$ruolo] . '` as ' . $ruolo;
        }
    }
    $query = $db->query('select ' . implode(', ', $campi) . ' from `' . $tabella . '` limit ' . $massimo);

    $indice = [];
    foreach ($query->fetchAll() as $riga) {
        $chiave = normalizzaNomeCarta((string) ($riga['nome'] ?? ''));
        if ($chiave === '' || strlen($chiave) < 2) {
            continue;
        }
        $prezzo = prezzoInMonete($riga['prezzo'] ?? 0);
        if ($prezzo <= 0) {
            continue;
        }
        $voce = [
            // Il nome com'e' scritto nella tabella, non la chiave: serve a
            // mostrarlo e a ritrovarlo nel catalogo.
            'nome' => trim((string) ($riga['nome'] ?? '')),
            'prezzo' => $prezzo,
            'voto' => isset($riga['valutazione']) ? (int) $riga['valutazione'] : 0,
            'quando' => quandoRagionevole($riga['aggiornato'] ?? null, $ora),
            'piattaforma' => isset($riga['piattaforma']) ? strtolower(trim((string) $riga['piattaforma'])) : '',
        ];
        $indice[$chiave][] = $voce;
    }
    return $indice;
}

/**
 * La riga giusta per una carta, fra quelle che hanno quel nome.
 *
 * Con la valutazione si sceglie quella: nelle tabelle dei prezzi lo stesso
 * nome puo' comparire piu' volte, una per versione della carta, e prendere la
 * prima vorrebbe dire mostrare il prezzo dell'oro comune su una carta
 * speciale. Senza valutazione, e se le righe sono piu' d'una, non si sceglie:
 * meglio nessun prezzo che il prezzo di un'altra carta.
 */
function scegliRigaSorgente(array $righe, int $voto, string $piattaforma): ?array
{
    if ($piattaforma !== '') {
        $perPiattaforma = array_values(array_filter(
            $righe,
            static fn ($riga) => $riga['piattaforma'] === '' || $riga['piattaforma'] === $piattaforma,
        ));
        if (count($perPiattaforma) > 0) {
            $righe = $perPiattaforma;
        }
    }
    if ($voto > 0) {
        foreach ($righe as $riga) {
            if ($riga['voto'] === $voto) {
                return $riga;
            }
        }
        // Se nella tabella la valutazione non c'e' proprio, una riga sola per
        // quel nome e' comunque quella: non c'e' niente da confondere.
        $senzaVoto = array_values(array_filter($righe, static fn ($riga) => $riga['voto'] === 0));
        if (count($senzaVoto) === 1) {
            return $senzaVoto[0];
        }
        return null;
    }
    return count($righe) === 1 ? $righe[0] : null;
}
