// I doppioni, e come si riconoscono senza fare danni.
//
// Prima che esistesse il catalogo, un prezzo incollato per un nome mai visto
// creava una carta con la valutazione a zero: era l'unico modo per dargli un
// posto dove stare. Poi e' arrivato il catalogo, e la stessa persona ha
// adesso due carte — «Klara Bühl» senza voto e «Klara Bühl 88» — perche'
// l'identificativo si calcola da nome **e** valutazione, e zero non e'
// ottantotto. Sono lo stesso giocatore, e vanno uniti.
//
// La parte delicata e' sapere quando NON unire. Nel file dei giocatori ci
// sono centotrentotto nomi che appartengono a due persone diverse: «Vitinha
// 90» gioca nel PSG, «Vitinha 75» e' un altro. Una carta «Vitinha» senza voto
// potrebbe essere l'uno o l'altro, e indovinare vuol dire regalare il prezzo
// del PSG a uno sconosciuto, per sempre e su tutti i dispositivi. Quelle non
// si toccano: si mettono da parte e le guardi tu.
//
// C'e' un secondo modo in cui lo stesso giocatore si sdoppia: il nome
// scritto in due forme. Il catalogo la chiama «Aitana Bonmatí», l'elenco dei
// prezzi «Aitana Bonmatí Conca», e per l'app sono due persone. Anche qui la
// risposta non si indovina: sta nel file, che di ogni giocatore riporta il
// nome comune, il nome completo e il cognome. Quelle forme diventano alias,
// e valgono solo quando portano a una persona sola — «Mbappé» da solo e'
// Kylian o Ethan, «Haaland» e' Erling o Markus, e quelli restano fuori.
//
// Quindi: si unisce solo quando la risposta e' una sola.

import { indicePerNome } from './catalog.mjs'
import { normalizeName } from './text.mjs'

function voto(carta) {
  const valore = Math.round(Number(carta?.rating) || 0)
  return valore > 0 ? valore : 0
}

/**
 * Divide le carte in doppioni sicuri e casi ambigui.
 *
 * @param carte tutte le carte che l'app conosce: catalogo, viste, listino.
 * @returns `unioni` sono le coppie da fondere (`da` sparisce dentro `a`),
 *   `ambigui` i nomi senza voto che corrispondono a piu' giocatori diversi.
 */
export function trovaDoppioni(carte = []) {
  const valide = carte.filter((carta) => carta?.id && carta?.name && normalizeName(carta.name).length >= 2)
  const { nomi, alias, contesi } = indicePerNome(valide)

  const unioni = []
  const ambigui = []
  const sistemate = new Set()

  const segnalaAmbiguo = (carta, candidati) => {
    ambigui.push({
      nome: carta.name,
      id: carta.id,
      candidati: [...candidati]
        .sort((a, b) => voto(b) - voto(a))
        .map((scelta) => ({ id: scelta.id, nome: scelta.name, voto: voto(scelta), club: scelta.club ?? '' })),
    })
  }

  // Primo giro: stesso nome scritto uguale. E' il caso di gran lunga piu'
  // comune — il segnaposto nato da un prezzo incollato e la carta del
  // catalogo si chiamano allo stesso modo, cambia solo il voto.
  for (const gruppo of nomi.values()) {
    const senzaVoto = gruppo.filter((carta) => voto(carta) === 0)
    if (senzaVoto.length === 0) continue
    const conVoto = gruppo.filter((carta) => voto(carta) > 0)
    const distinti = new Set(conVoto.map((carta) => voto(carta)))

    if (distinti.size === 0) continue
    if (distinti.size > 1) {
      for (const doppione of senzaVoto) {
        sistemate.add(doppione.id)
        segnalaAmbiguo(doppione, conVoto)
      }
      continue
    }

    const buona = conVoto.reduce((migliore, carta) => (voto(carta) > voto(migliore) ? carta : migliore))
    for (const doppione of senzaVoto) {
      sistemate.add(doppione.id)
      if (doppione.id === buona.id) continue
      unioni.push({ da: doppione.id, a: buona.id, nome: buona.name, voto: voto(buona) })
    }
  }

  // Secondo giro: lo stesso giocatore scritto in un altro modo. Il file dice
  // che «Aitana Bonmatí» per esteso e' «Aitana Bonmatí Conca»; se l'elenco
  // dei prezzi usava quella forma, e' nata una carta a parte.
  for (const carta of valide) {
    if (voto(carta) > 0 || sistemate.has(carta.id)) continue
    const chiave = normalizeName(carta.name)
    const buona = alias.get(chiave)
    if (buona && voto(buona) > 0 && buona.id !== carta.id) {
      sistemate.add(carta.id)
      unioni.push({ da: carta.id, a: buona.id, nome: buona.name, voto: voto(buona) })
      continue
    }
    const contesa = contesi.get(chiave)
    if (contesa && contesa.length > 1) {
      sistemate.add(carta.id)
      segnalaAmbiguo(carta, contesa)
    }
  }

  unioni.sort((a, b) => a.nome.localeCompare(b.nome, 'it'))
  ambigui.sort((a, b) => a.nome.localeCompare(b.nome, 'it'))
  return { unioni, ambigui }
}

/** La mappa `vecchio id → nuovo id`, con le catene gia' risolte. */
export function mappaUnioni(unioni = []) {
  const mappa = new Map()
  for (const { da, a } of unioni) {
    if (!da || !a || da === a) continue
    mappa.set(da, a)
  }
  // Se A e' stato unito a B e B a C, A deve finire in C: senza questo passo
  // resterebbe attaccato a una carta che non c'e' piu'.
  for (const da of [...mappa.keys()]) {
    const visti = new Set([da])
    let arrivo = mappa.get(da)
    while (mappa.has(arrivo) && !visti.has(arrivo)) {
      visti.add(arrivo)
      arrivo = mappa.get(arrivo)
    }
    mappa.set(da, arrivo)
  }
  return mappa
}

const GIORNO = 86_400_000
const MAX_PUNTI = 60

/**
 * Due storici della stessa carta diventano uno: un punto al giorno, e dove
 * cadono nello stesso giorno resta il piu' recente. E' la stessa regola con
 * cui lo storico si scrive normalmente.
 */
export function unisciStorico(primo = [], secondo = []) {
  const perGiorno = new Map()
  for (const punto of [...primo, ...secondo]) {
    if (!punto || !(punto.price > 0)) continue
    const chiave = Math.floor(punto.t / GIORNO)
    const presente = perGiorno.get(chiave)
    if (!presente || punto.t >= presente.t) perGiorno.set(chiave, { t: punto.t, price: punto.price })
  }
  return [...perGiorno.values()].sort((a, b) => a.t - b.t).slice(-MAX_PUNTI)
}

/** Fra due osservazioni dello stesso prezzo vince la piu' recente. */
function piuRecente(primo, secondo) {
  if (!primo) return secondo
  if (!secondo) return primo
  return (secondo.at ?? 0) > (primo.at ?? 0) ? secondo : primo
}

function spostaMappa(origine = {}, mappa, fondi = piuRecente) {
  let cambiato = false
  const uscita = {}
  for (const [id, valore] of Object.entries(origine)) {
    const arrivo = mappa.get(id) ?? id
    if (arrivo !== id) cambiato = true
    uscita[arrivo] = arrivo in uscita ? fondi(uscita[arrivo], valore) : valore
  }
  return cambiato ? uscita : origine
}

/**
 * Applica le unioni a tutti i dati dell'app.
 *
 * Un identificativo non sta in un posto solo: e' nella rosa, nella watchlist,
 * nei prezzi scritti a mano, nello storico, nel listino scaricato e negli
 * avvisi. Lasciarne indietro uno vuol dire una posizione che punta a una
 * carta che non esiste piu', cioe' una riga senza nome.
 */
export function applicaUnioni(data, unioni = []) {
  const mappa = mappaUnioni(unioni)
  if (mappa.size === 0) return { data, unite: 0 }

  const sposta = (id) => mappa.get(id) ?? id

  // Nome e valutazione buoni, presi dall'unione stessa: servono a rimettere
  // in sesto le copie del giocatore sparse per i dati, che il segnaposto
  // aveva lasciato senza voto.
  const buone = new Map()
  for (const { a, nome, voto: valutazione } of unioni) {
    if (a && valutazione > 0) buone.set(a, { name: nome, rating: valutazione })
  }
  const buona = (id, ripiego) => {
    const nota = buone.get(id)
    if (!nota) return ripiego
    if ((Number(ripiego?.rating) || 0) >= nota.rating) return ripiego
    return { ...ripiego, name: nota.name, rating: nota.rating }
  }

  const perId = new Map()
  for (const carta of data.seen ?? []) {
    const id = sposta(carta.id)
    const presente = perId.get(id)
    // Vince la carta con la valutazione: e' quella buona, il segnaposto no —
    // e con lei restano club, ruolo e il resto, che il segnaposto non ha.
    if (!presente || (Number(carta.rating) || 0) > (Number(presente.rating) || 0)) {
      perId.set(id, { ...carta, id })
    }
  }
  // Il ritocco del voto viene dopo: farlo mentre si sceglie farebbe sembrare
  // completo il segnaposto, e vincerebbe lui.
  for (const [id, carta] of perId) perId.set(id, buona(id, carta))

  const watchlist = []
  const vistiInWatch = new Set()
  for (const voce of data.watchlist ?? []) {
    const id = sposta(voce.id)
    if (vistiInWatch.has(id)) continue
    vistiInWatch.add(id)
    const carta = perId.get(id)
    watchlist.push(buona(id, { ...voce, id, rating: carta?.rating || voce.rating, name: carta?.name || voce.name }))
  }

  const priceHistory = {}
  for (const [id, punti] of Object.entries(data.priceHistory ?? {})) {
    const arrivo = sposta(id)
    priceHistory[arrivo] = arrivo in priceHistory ? unisciStorico(priceHistory[arrivo], punti) : punti
  }

  return {
    data: {
      ...data,
      seen: [...perId.values()],
      watchlist,
      positions: (data.positions ?? []).map((posizione) => ({ ...posizione, playerId: sposta(posizione.playerId) })),
      alerts: (data.alerts ?? []).map((avviso) =>
        avviso.playerId ? { ...avviso, playerId: sposta(avviso.playerId) } : avviso,
      ),
      manualPrices: spostaMappa(data.manualPrices, mappa),
      sharedPrices: spostaMappa(data.sharedPrices, mappa),
      sharedPlayers: Object.fromEntries(
        Object.entries(
          spostaMappa(data.sharedPlayers, mappa, (primo, secondo) =>
            (Number(secondo?.rating) || 0) > (Number(primo?.rating) || 0) ? secondo : primo,
          ),
        ).map(([id, voce]) => [id, buona(id, voce)]),
      ),
      priceHistory,
    },
    unite: mappa.size,
  }
}
