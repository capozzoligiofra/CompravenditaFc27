// L'indirizzo del listino, ripulito.
//
// Sta qui, fra la logica pura, perche' e' il punto in cui un errore non si
// vede: un indirizzo storto non da' un messaggio chiaro, da' richieste che
// falliscono in modi strani. E i modi di scriverlo storto sono tutti naturali
// — il sito senza «api.php», la barra finale, e soprattutto l'indirizzo
// copiato dalla barra del browser dopo aver provato «api.php?azione=salute»,
// che si porta dietro la domanda.

/** L'indirizzo di api.php, comunque tu l'abbia scritto. */
export function normalizzaServer(indirizzo) {
  const pulito = String(indirizzo ?? '').trim().replace(/\s+/g, '')
  if (!pulito) return ''
  const conProtocollo = /^https?:\/\//i.test(pulito) ? pulito : `https://${pulito}`
  // Via tutto quello che viene dopo «?» o «#»: la domanda non fa parte
  // dell'indirizzo, e lasciandola l'app finirebbe a chiamare
  // «api.php?azione=salute/api.php».
  const senzaDomanda = conProtocollo.split(/[?#]/)[0]
  const senzaBarra = senzaDomanda.replace(/\/+$/, '')
  return /api\.php$/i.test(senzaBarra) ? senzaBarra : `${senzaBarra}/api.php`
}
