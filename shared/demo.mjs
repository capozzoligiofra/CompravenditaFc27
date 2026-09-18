// Dataset demo: serve quando Futbin non è raggiungibile (rete bloccata,
// endpoint cambiato, FUTBIN_ENABLED=false) così l'app resta usabile e
// testabile senza dipendere da nessun servizio esterno.
//
// I prezzi sono plausibili ma inventati: l'interfaccia lo segnala sempre
// con il badge "DEMO".

import { normalizeName } from './text.mjs'

const ROSTER = [
  { id: '1001', name: 'Kylian Mbappé', rating: 92, position: 'ST', club: 'Real Madrid', league: 'LaLiga', nation: 'Francia', version: 'Oro Raro', price: 1_450_000 },
  { id: '1002', name: 'Erling Haaland', rating: 91, position: 'ST', club: 'Manchester City', league: 'Premier League', nation: 'Norvegia', version: 'Oro Raro', price: 980_000 },
  { id: '1003', name: 'Jude Bellingham', rating: 90, position: 'CAM', club: 'Real Madrid', league: 'LaLiga', nation: 'Inghilterra', version: 'Oro Raro', price: 640_000 },
  { id: '1004', name: 'Vinícius Júnior', rating: 90, position: 'LW', club: 'Real Madrid', league: 'LaLiga', nation: 'Brasile', version: 'Oro Raro', price: 720_000 },
  { id: '1005', name: 'Rodri', rating: 89, position: 'CDM', club: 'Manchester City', league: 'Premier League', nation: 'Spagna', version: 'Oro Raro', price: 310_000 },
  { id: '1006', name: 'Lautaro Martínez', rating: 88, position: 'ST', club: 'Inter', league: 'Serie A', nation: 'Argentina', version: 'Oro Raro', price: 148_000 },
  { id: '1007', name: 'Federico Dimarco', rating: 86, position: 'LB', club: 'Inter', league: 'Serie A', nation: 'Italia', version: 'Oro Raro', price: 62_000 },
  { id: '1008', name: 'Nicolò Barella', rating: 87, position: 'CM', club: 'Inter', league: 'Serie A', nation: 'Italia', version: 'Oro Raro', price: 74_500 },
  { id: '1009', name: 'Rafael Leão', rating: 86, position: 'LW', club: 'Milan', league: 'Serie A', nation: 'Portogallo', version: 'Oro Raro', price: 58_000 },
  { id: '1010', name: 'Khvicha Kvaratskhelia', rating: 87, position: 'LW', club: 'Paris SG', league: 'Ligue 1', nation: 'Georgia', version: 'Oro Raro', price: 96_000 },
  { id: '1011', name: 'Bukayo Saka', rating: 88, position: 'RW', club: 'Arsenal', league: 'Premier League', nation: 'Inghilterra', version: 'Oro Raro', price: 205_000 },
  { id: '1012', name: 'Alexander Isak', rating: 86, position: 'ST', club: 'Liverpool', league: 'Premier League', nation: 'Svezia', version: 'Oro Raro', price: 84_000 },
  { id: '1013', name: 'Florian Wirtz', rating: 88, position: 'CAM', club: 'Liverpool', league: 'Premier League', nation: 'Germania', version: 'Oro Raro', price: 168_000 },
  { id: '1014', name: 'Jamal Musiala', rating: 88, position: 'CAM', club: 'Bayern München', league: 'Bundesliga', nation: 'Germania', version: 'Oro Raro', price: 152_000 },
  { id: '1015', name: 'Achraf Hakimi', rating: 87, position: 'RB', club: 'Paris SG', league: 'Ligue 1', nation: 'Marocco', version: 'Oro Raro', price: 118_000 },
  { id: '1016', name: 'Virgil van Dijk', rating: 88, position: 'CB', club: 'Liverpool', league: 'Premier League', nation: 'Paesi Bassi', version: 'Oro Raro', price: 92_000 },
  { id: '1017', name: 'Alessandro Bastoni', rating: 86, position: 'CB', club: 'Inter', league: 'Serie A', nation: 'Italia', version: 'Oro Raro', price: 44_000 },
  { id: '1018', name: 'Gianluigi Donnarumma', rating: 88, position: 'GK', club: 'Manchester City', league: 'Premier League', nation: 'Italia', version: 'Oro Raro', price: 63_000 },
  { id: '1019', name: 'Pedri', rating: 88, position: 'CM', club: 'Barcelona', league: 'LaLiga', nation: 'Spagna', version: 'Oro Raro', price: 124_000 },
  { id: '1020', name: 'Lamine Yamal', rating: 89, position: 'RW', club: 'Barcelona', league: 'LaLiga', nation: 'Spagna', version: 'Oro Raro', price: 430_000 },
  { id: '1021', name: 'Cole Palmer', rating: 87, position: 'CAM', club: 'Chelsea', league: 'Premier League', nation: 'Inghilterra', version: 'Oro Raro', price: 110_000 },
  { id: '1022', name: 'Declan Rice', rating: 87, position: 'CDM', club: 'Arsenal', league: 'Premier League', nation: 'Inghilterra', version: 'Oro Raro', price: 78_000 },
  { id: '1023', name: 'Antonio Rüdiger', rating: 85, position: 'CB', club: 'Real Madrid', league: 'LaLiga', nation: 'Germania', version: 'Oro Raro', price: 21_000 },
  { id: '1024', name: 'Theo Hernández', rating: 85, position: 'LB', club: 'Al Hilal', league: 'Saudi League', nation: 'Francia', version: 'Oro Raro', price: 17_500 },
  { id: '1025', name: 'Moise Kean', rating: 84, position: 'ST', club: 'Fiorentina', league: 'Serie A', nation: 'Italia', version: 'Oro Raro', price: 12_800 },
  { id: '1026', name: 'Ademola Lookman', rating: 85, position: 'LW', club: 'Atalanta', league: 'Serie A', nation: 'Nigeria', version: 'Oro Raro', price: 19_400 },
  { id: '1027', name: 'Michael Olise', rating: 87, position: 'RW', club: 'Bayern München', league: 'Bundesliga', nation: 'Francia', version: 'Oro Raro', price: 132_000 },
  { id: '1028', name: 'João Neves', rating: 86, position: 'CM', club: 'Paris SG', league: 'Ligue 1', nation: 'Portogallo', version: 'Oro Raro', price: 57_000 },
  { id: '1029', name: 'Désiré Doué', rating: 85, position: 'RW', club: 'Paris SG', league: 'Ligue 1', nation: 'Francia', version: 'Oro Raro', price: 39_500 },
  { id: '1030', name: 'Warren Zaïre-Emery', rating: 84, position: 'CM', club: 'Paris SG', league: 'Ligue 1', nation: 'Francia', version: 'Oro Raro', price: 14_200 },
]

const PLATFORM_FACTOR = { ps: 1, xbox: 1.02, pc: 0.88 }

/** Rumore deterministico: la demo mostra sempre la stessa curva per lo stesso giorno. */
function noise(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

function roundCoins(value) {
  if (value >= 100_000) return Math.round(value / 1000) * 1000
  if (value >= 10_000) return Math.round(value / 250) * 250
  if (value >= 1_000) return Math.round(value / 50) * 50
  return Math.max(200, Math.round(value / 10) * 10)
}

function dayIndex(timestamp) {
  return Math.floor(timestamp / 86_400_000)
}

/** Curva su 30 giorni: trend lento + oscillazione giornaliera + calo serale. */
export function demoHistory(playerId, platform, days = 30) {
  const player = ROSTER.find((item) => item.id === String(playerId))
  if (!player) return []
  const base = player.price * (PLATFORM_FACTOR[platform] ?? 1)
  const today = dayIndex(Date.now())
  const seedBase = Number(player.id)
  const points = []
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = today - offset
    const wave = Math.sin((day + seedBase) / 4.5) * 0.06
    const drift = ((noise(seedBase + day) - 0.5) * 2) * 0.045
    const price = roundCoins(base * (1 + wave + drift))
    points.push({ t: day * 86_400_000, price })
  }
  return points
}

export function demoPrices(playerId) {
  const player = ROSTER.find((item) => item.id === String(playerId))
  if (!player) return null
  const result = {}
  for (const platform of ['ps', 'xbox', 'pc']) {
    const history = demoHistory(playerId, platform, 30)
    const price = history.at(-1)?.price ?? roundCoins(player.price)
    const yesterday = history.at(-2)?.price ?? price
    const window = history.slice(-7).map((point) => point.price)
    result[platform] = {
      price,
      minPrice: Math.min(...window),
      maxPrice: Math.max(...window),
      changePercent: yesterday ? Number((((price - yesterday) / yesterday) * 100).toFixed(1)) : 0,
      updated: 'dataset demo',
    }
  }
  return result
}

export function demoSearch(query) {
  const term = normalizeName(query)
  if (!term) return ROSTER.slice(0, 12).map(toPlayer)
  return ROSTER.filter((player) =>
    normalizeName([player.name, player.club, player.nation, player.league, player.position].join(' ')).includes(term),
  )
    .slice(0, 25)
    .map(toPlayer)
}

export function demoPlayer(playerId) {
  const player = ROSTER.find((item) => item.id === String(playerId))
  return player ? toPlayer(player) : null
}

export function demoRoster() {
  return ROSTER.map(toPlayer)
}

function toPlayer(player) {
  const { price: _price, ...rest } = player
  return { ...rest, image: '' }
}
