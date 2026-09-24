import { Link } from 'react-router-dom'

import type { ReactNode } from 'react'

/**
 * Il nome di una carta, ovunque compaia, porta alla sua scheda. È la regola
 * più semplice da ricordare per chi usa l'app: se leggi un nome, ci puoi
 * cliccare sopra.
 */
export default function PlayerLink({
  id,
  children,
  className = '',
}: {
  id: string
  children: ReactNode
  className?: string
}) {
  if (!id) return <span className={className}>{children}</span>
  return (
    <Link
      to={`/carta/${encodeURIComponent(id)}`}
      className={`underline decoration-pitch-line decoration-dotted underline-offset-4 transition hover:decoration-gain hover:text-gain ${className}`}
    >
      {children}
    </Link>
  )
}
