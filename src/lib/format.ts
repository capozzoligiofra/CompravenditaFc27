const coinFormatter = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 })

export function coins(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return coinFormatter.format(Math.round(value))
}

export function compactCoins(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '—'
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2).replace('.', ',')}M`
  if (abs >= 10_000) return `${Math.round(value / 1_000)}K`
  return coins(value)
}

export function signedCoins(value: number): string {
  const rounded = Math.round(value)
  return `${rounded > 0 ? '+' : ''}${coins(rounded)}`
}

export function percent(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '—'
  return `${value > 0 ? '+' : ''}${value.toFixed(digits).replace('.', ',')}%`
}

export function shortDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })
}

export function dateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
