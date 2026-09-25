// Il listino condiviso: come si mettono d'accordo i prezzi di due dispositivi.
//
// Ognuno scrive i prezzi quando può, anche senza rete; poi, appena la linea
// torna, il server e il telefono si scambiano quello che si sono persi. La
// regola per decidere chi ha ragione è una sola e vale nei due sensi: **vince
// l'osservazione più recente**. Non «vince il server» — se hai appena scritto
// un prezzo in metropolitana, quello è più fresco di quello di ieri sera che
// sta sul server, e deve sopravvivere alla sincronizzazione.
//
// I tempi qui dentro sono due, e non vanno confusi:
//   at         quando il prezzo è stato visto in gioco (orologio di chi scrive)
//   aggiornato quando il server l'ha registrato (orologio del server)
// Il primo serve a decidere chi vince, il secondo a chiedere «cos'è cambiato
// da quando ti ho sentito l'ultima volta».

/**
 * Il prezzo buono per ogni carta, fra i tre posti da cui puo' arrivare: la
 * sorgente automatica, il listino del gruppo e quello che hai scritto tu.
 *
 * La regola non cambia: vince l'osservazione più recente. A parità di data
 * vince la tua, perché se hai appena guardato il mercato con i tuoi occhi
 * quella è l'osservazione, non la copia.
 *
 * Quello che perde non si cancella: resta dov'è, e torna a valere appena è di
 * nuovo il più fresco. Qui si decide solo cosa mostrare.
 */
export function prezziEffettivi(locali = {}, condivisi = {}, sorgente = {}) {
  const fuse = {}
  const metti = (id, voce, extra = {}) => {
    if (!(voce?.price > 0)) return
    const presente = fuse[id]
    if (presente && (presente.at ?? 0) > (voce.at ?? 0)) return
    fuse[id] = { price: voce.price, at: voce.at ?? 0, ...extra, ...(voce.autore ? { autore: voce.autore } : {}) }
  }
  for (const [id, voce] of Object.entries(sorgente)) metti(id, voce, { origine: 'sorgente' })
  for (const [id, voce] of Object.entries(condivisi)) metti(id, voce)
  for (const [id, voce] of Object.entries(locali)) metti(id, voce)
  return fuse
}

/**
 * Quello che il server non ha ancora: i prezzi che hai scritto tu e che sono
 * più recenti della copia condivisa. È ciò che va spedito alla prima occasione.
 */
export function daInviare(locali = {}, condivisi = {}) {
  const elenco = []
  for (const [id, voce] of Object.entries(locali)) {
    if (!(voce?.price > 0)) continue
    const remoto = condivisi[id]
    const mio = voce.at ?? 0
    // A pari data vince il comune: se due dispositivi si rimandassero a
    // vicenda la stessa osservazione, la sincronizzazione non finirebbe mai.
    if (remoto && (remoto.at ?? 0) >= mio) continue
    elenco.push({ id, price: Math.round(voce.price), at: mio })
  }
  return elenco.sort((a, b) => a.at - b.at)
}

/**
 * Applica al listino locale quello che è arrivato dal server. Un prezzo più
 * vecchio di quello che hai già non lo sovrascrive: la rete può consegnare
 * fuori ordine, e una risposta in ritardo non deve far tornare indietro il
 * listino.
 */
export function applicaRemoti(condivisi = {}, remoti = []) {
  const prossimo = { ...condivisi }
  let cambiato = false
  for (const voce of remoti) {
    const id = String(voce?.id ?? '')
    const price = Math.round(Number(voce?.price) || 0)
    if (!id || price <= 0) continue
    const at = Number(voce.at) || 0
    const attuale = prossimo[id]
    if (attuale && (attuale.at ?? 0) > at) continue
    if (attuale && attuale.price === price && (attuale.at ?? 0) === at) continue
    prossimo[id] = { price, at, autore: voce.autore ? String(voce.autore) : '' }
    cambiato = true
  }
  return { condivisi: cambiato ? prossimo : condivisi, cambiato }
}

/**
 * I prezzi locali che il listino comune ha già assorbito, identici: tenerne
 * due copie non serve, e cancellarli evita di rispedirli per sempre.
 */
export function localiSuperati(locali = {}, condivisi = {}) {
  return Object.entries(locali)
    .filter(([id, voce]) => {
      const remoto = condivisi[id]
      return Boolean(remoto) && remoto.price === voce?.price && (remoto.at ?? 0) >= (voce?.at ?? 0)
    })
    .map(([id]) => id)
}

/** Un insieme di dati personali senza niente dentro: rosa, watchlist, schede. */
export function datiVuoti(dati) {
  if (!dati || typeof dati !== 'object') return true
  const conta = (elenco) => (Array.isArray(elenco) ? elenco.length : 0)
  return conta(dati.watchlist) + conta(dati.positions) + conta(dati.seen) === 0
}

/**
 * Cosa fare dei dati personali quando due dispositivi hanno versioni diverse:
 * vince l'ultima salvata. Con una cautela — una copia vuota non cancella una
 * copia piena, per quanto sia più recente. È il caso del telefono nuovo che
 * si collega per la prima volta: deve ricevere la rosa, non azzerarla.
 */
export function scegliDati({ locale = null, localeAggiornatoAl = 0, remoto = null, remotoAggiornatoAl = 0 } = {}) {
  const localeHaRoba = !datiVuoti(locale)
  const remotoHaRoba = !datiVuoti(remoto)

  if (!localeHaRoba && !remotoHaRoba) return 'niente'
  if (!remotoHaRoba) return 'invia'
  if (!localeHaRoba) return 'applica'
  if (remotoAggiornatoAl > localeAggiornatoAl) return 'applica'
  if (localeAggiornatoAl > remotoAggiornatoAl) return 'invia'
  return 'niente'
}
