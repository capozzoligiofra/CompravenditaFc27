// Catalizzatori: gli eventi che fanno salire la domanda su certe carte.
//
// Tipici: una SBC che chiede giocatori di una certa lega o fascia di
// valutazione, un obiettivo che premia chi segna con una nazionalità
// precisa, una promo che mette sotto i riflettori un campionato. Qui stanno
// la forma del dato e le regole per capire se un giocatore è coinvolto.

/** Fasce di valutazione più richieste dalle SBC (il cosiddetto "fodder"). */
export const FODDER_MIN = 83
export const FODDER_MAX = 86

export function normalizeCatalyst(raw) {
  const match = raw?.match ?? {}
  return {
    id: String(raw?.id ?? `cat-${Math.random().toString(36).slice(2, 10)}`),
    kind: raw?.kind ?? 'manuale',
    title: String(raw?.title ?? 'Catalizzatore'),
    detail: String(raw?.detail ?? ''),
    source: raw?.source ?? 'manuale',
    startsAt: typeof raw?.startsAt === 'number' ? raw.startsAt : null,
    endsAt: typeof raw?.endsAt === 'number' ? raw.endsAt : null,
    impact: clamp(Number(raw?.impact ?? 2), 1, 3),
    match: {
      minRating: numberOrNull(match.minRating),
      maxRating: numberOrNull(match.maxRating),
      leagues: toList(match.leagues),
      nations: toList(match.nations),
      clubs: toList(match.clubs),
      positions: toList(match.positions),
      players: toList(match.players),
    },
  }
}

function numberOrNull(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function toList(value) {
  if (!value) return []
  const list = Array.isArray(value) ? value : String(value).split(',')
  return list.map((item) => String(item).trim().toLowerCase()).filter(Boolean)
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

/** Un catalizzatore è "vivo" se è già iniziato e non è ancora scaduto. */
export function isActive(catalyst, now = Date.now()) {
  if (catalyst.endsAt && catalyst.endsAt < now) return false
  if (catalyst.startsAt && catalyst.startsAt > now + 48 * 3_600_000) return false
  return true
}

export function isImminent(catalyst, now = Date.now()) {
  return Boolean(catalyst.startsAt && catalyst.startsAt > now)
}

// Futbin scrive in inglese, il dataset e le note dell'utente in italiano:
// senza queste equivalenze una SBC "Italy" non troverebbe i giocatori
// italiani.
const SINONIMI = [
  ['italia', 'italy'],
  ['inghilterra', 'england'],
  ['francia', 'france'],
  ['germania', 'germany'],
  ['spagna', 'spain'],
  ['brasile', 'brazil'],
  ['portogallo', 'portugal'],
  ['paesi bassi', 'netherlands', 'holland', 'olanda'],
  ['belgio', 'belgium'],
  ['svezia', 'sweden'],
  ['norvegia', 'norway'],
  ['marocco', 'morocco'],
  ['nigeria'],
  ['georgia'],
  ['argentina'],
  ['laliga', 'la liga', 'liga spagnola'],
  ['serie a', 'calcio a', 'lega italiana'],
  ['premier league', 'lega inglese'],
  ['bundesliga', 'lega tedesca'],
  ['ligue 1', 'lega francese'],
  ['saudi league', 'saudi pro league', 'lega saudita'],
]

/** Riporta un nome alla sua forma canonica (la prima della lista). */
export function canonicalToken(value) {
  const text = String(value ?? '').trim().toLowerCase()
  if (!text) return ''
  for (const gruppo of SINONIMI) {
    if (gruppo.some((voce) => text === voce || text.includes(voce))) return gruppo[0]
  }
  return text
}

function includesLoose(list, value) {
  if (list.length === 0) return null
  const raw = String(value ?? '').trim().toLowerCase()
  if (!raw) return false
  const target = canonicalToken(raw)
  return list.some((item) => {
    const candidate = canonicalToken(item)
    return (
      candidate === target ||
      raw.includes(item) ||
      item.includes(raw) ||
      (candidate.length > 2 && target.includes(candidate)) ||
      (target.length > 2 && candidate.includes(target))
    )
  })
}

/**
 * Il giocatore è coinvolto dal catalizzatore? Un criterio vuoto non filtra;
 * se invece è indicato deve corrispondere, altrimenti si scarta la carta.
 */
export function matchesPlayer(catalyst, player) {
  const rules = catalyst.match
  const rating = Number(player?.rating ?? 0)
  if (rules.minRating && rating && rating < rules.minRating) return false
  if (rules.maxRating && rating && rating > rules.maxRating) return false

  const checks = [
    includesLoose(rules.leagues, player?.league),
    includesLoose(rules.nations, player?.nation),
    includesLoose(rules.clubs, player?.club),
    includesLoose(rules.positions, player?.position),
    includesLoose(rules.players, player?.name),
  ]
  // Almeno uno dei criteri indicati deve corrispondere; se non ne è indicato
  // nessuno vale la sola fascia di valutazione.
  const declared = checks.filter((result) => result !== null)
  if (declared.length === 0) return Boolean(rules.minRating || rules.maxRating)
  return declared.some(Boolean)
}

export function matchingCatalysts(player, catalysts, now = Date.now()) {
  return catalysts.filter((catalyst) => isActive(catalyst, now) && matchesPlayer(catalyst, player))
}

export function isFodder(player) {
  const rating = Number(player?.rating ?? 0)
  return rating >= FODDER_MIN && rating <= FODDER_MAX
}
