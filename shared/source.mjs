// La sorgente automatica, vista dal lato dell'app: come si attaccano i prezzi
// di una tabella alle carte che l'app conosce.
//
// Il problema e' che le due parti non parlano la stessa lingua. La tabella
// dei prezzi ha dei nomi — «Aitana Bonmatí», «Vitinha» — e spesso nient'altro;
// l'app ha carte identificate da nome **e** valutazione, perche' «Vitinha 90»
// del PSG e «Vitinha 75» sono due persone. La valutazione, quando la tabella
// non ce l'ha, la mette il catalogo.
//
// Dove il catalogo non basta a decidere, non si decide. Un nome che nel
// catalogo corrisponde a due giocatori con valutazioni diverse viene messo da
// parte e dichiarato, non assegnato al piu' forte: dare a una carta il prezzo
// di un'altra e' un errore che non si vede — il numero c'e', sembra giusto, e
// ti fa comprare la persona sbagliata.

import { idCarta } from './catalog.mjs'
import { normalizeName } from './text.mjs'

/**
 * Abbina le righe della sorgente alle carte del catalogo.
 *
 * @param righe  `[{nome, voto, price, at}]` come le manda il server.
 * @param indice l'indice del catalogo, da `indicePerNome`.
 * @returns `prezzi` da mostrare, `carte` da far comparire nel pannello,
 *   `contesi` i nomi su cui non si e' potuto decidere, `sconosciuti` quelli
 *   che nel catalogo non ci sono affatto.
 */
export function abbinaSorgente(righe = [], indice = { nomi: new Map(), alias: new Map() }) {
  const prezzi = {}
  const carte = {}
  const contesi = []
  const sconosciuti = []

  for (const riga of righe) {
    const nome = String(riga?.nome ?? '').trim()
    const prezzo = Math.round(Number(riga?.price) || 0)
    if (nome.length < 2 || prezzo <= 0) continue

    const chiave = normalizeName(nome)
    const voto = Math.max(0, Math.round(Number(riga?.voto) || 0))
    let carta = null

    if (voto > 0) {
      // La tabella ha la valutazione: e' lei a comandare, il catalogo serve
      // solo a prendere il nome come lo scrive lui.
      const fra = indice.nomi?.get(chiave) ?? []
      carta = fra.find((scelta) => scelta.rating === voto) ?? { id: idCarta(nome, voto), name: nome, rating: voto }
    } else {
      const fra = indice.nomi?.get(chiave) ?? []
      const voti = new Set(fra.map((scelta) => Number(scelta.rating) || 0).filter((valore) => valore > 0))
      if (voti.size > 1) {
        contesi.push({ nome, voti: [...voti].sort((a, b) => b - a) })
        continue
      }
      if (voti.size === 1) {
        carta = fra.find((scelta) => (Number(scelta.rating) || 0) > 0)
      } else {
        // Nessun nome uguale: si prova con gli altri modi di scriverlo —
        // «Aitana Bonmatí Conca» per «Aitana Bonmatí» — che valgono solo
        // quando portano a una persona sola.
        const perAlias = indice.alias?.get(chiave)
        if (perAlias) carta = perAlias
      }
    }

    if (!carta) {
      // Non e' nel catalogo: il prezzo si mostra lo stesso, su una carta
      // senza valutazione. Meglio un prezzo con un nome che nessun prezzo —
      // e se il catalogo imparera' quel nome, i doppioni si uniscono da soli.
      const id = idCarta(nome, 0)
      if (!id) continue
      sconosciuti.push(nome)
      carta = { id, name: nome, rating: 0 }
    }

    // Due righe possono finire sulla stessa carta — «Aitana Bonmatí» e
    // «Aitana Bonmatí Conca» sono la stessa persona — e allora vale la piu'
    // recente, non l'ultima che capita di leggere.
    const quando = Number(riga?.at) || 0
    if (prezzi[carta.id] && (prezzi[carta.id].at ?? 0) > quando) continue
    prezzi[carta.id] = { price: prezzo, at: quando }
    carte[carta.id] = { name: carta.name, rating: Number(carta.rating) || 0 }
  }

  return { prezzi, carte, contesi, sconosciuti }
}
