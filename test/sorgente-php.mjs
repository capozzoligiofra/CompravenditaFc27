// Il ponte fra i test in Node e le funzioni in PHP: si chiama php a riga di
// comando, gli si passano i casi in JSON e si rilegge il risultato.
import { execFileSync } from 'node:child_process'
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export function phpDisponibile() {
  try {
    execFileSync('php', ['--version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

const PONTE = `<?php
if (getenv('SENZA_INTL')) define('FC27_SENZA_INTL', true);
require getenv('SORGENTE');
$casi = json_decode(file_get_contents(getenv('CASI')), true);
$fuori = [];
foreach ($casi as $caso) {
  $fuori[] = match ($caso['funzione']) {
    'id' => idCartaDaNome($caso['nome'], (int) ($caso['voto'] ?? 0)),
    'prezzo' => prezzoInMonete($caso['valore']),
    'quando' => quandoInMillisecondi($caso['valore']),
    'nome' => normalizzaNomeCarta($caso['valore']),
    'ragionevole' => quandoRagionevole($caso['valore'], (int) round(microtime(true) * 1000)),
    default => null,
  };
}
echo json_encode($fuori);
`

export function chiamaPhp(casi, { senzaIntl = false } = {}) {
  const cartella = mkdtempSync(join(tmpdir(), 'fc27-'))
  const ponte = join(cartella, 'ponte.php')
  const elenco = join(cartella, 'casi.json')
  writeFileSync(ponte, PONTE)
  writeFileSync(elenco, JSON.stringify(casi))
  const uscita = execFileSync('php', [ponte], {
    env: {
      ...process.env,
      SORGENTE: new URL('../server-php/sorgente.php', import.meta.url).pathname,
      CASI: elenco,
      ...(senzaIntl ? { SENZA_INTL: '1' } : {}),
    },
    encoding: 'utf8',
  })
  return JSON.parse(uscita)
}
