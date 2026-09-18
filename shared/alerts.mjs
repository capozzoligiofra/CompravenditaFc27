// Regole degli avvisi.
//
// Un avviso deve dire una cosa sola e azionabile: compra adesso, vendi
// adesso, sta per aprirsi una finestra. L'identificativo contiene il giorno
// e la fascia di prezzo, così lo stesso avviso non ricompare a ogni
// aggiornamento ma torna se la situazione cambia davvero.

import { profit, signalFor } from './market.mjs'

function dayKey(now) {
  return new Date(now).toISOString().slice(0, 10)
}

function bucket(price) {
  return Math.round(price / 500)
}

function alert(fields) {
  return { read: false, playerId: null, ...fields }
}

/**
 * @param context prezzi correnti, watchlist, posizioni aperte, occasioni già
 * calcolate, fase del ciclo e prossimi eventi.
 */
export function buildAlerts(context) {
  const {
    now = Date.now(),
    quotes = {},
    watchlist = [],
    positions = [],
    opportunities = [],
    sellVerdicts = [],
    phase = null,
    events = [],
    settings = {},
  } = context
  const tax = settings.taxPercent ?? 5
  const margin = settings.targetMarginPercent ?? 15
  const out = []

  // 1. Target della watchlist raggiunti.
  for (const item of watchlist) {
    const price = quotes[item.id]?.price ?? 0
    if (!price) continue
    const segnale = signalFor(price, item.buyTarget, item.sellTarget)
    if (segnale === 'compra') {
      out.push(
        alert({
          id: `compra:${item.id}:${dayKey(now)}:${bucket(price)}`,
          kind: 'compra',
          severity: 'urgente',
          title: `${item.name} è sceso al tuo prezzo`,
          body: `Ora costa ${price.toLocaleString('it-IT')} crediti, sotto il target di ${item.buyTarget.toLocaleString('it-IT')}.`,
          at: now,
          playerId: item.id,
        }),
      )
    } else if (segnale === 'vendi') {
      out.push(
        alert({
          id: `vendi:${item.id}:${dayKey(now)}:${bucket(price)}`,
          kind: 'vendi',
          severity: 'buona',
          title: `${item.name} ha raggiunto il prezzo di vendita`,
          body: `Quota ${price.toLocaleString('it-IT')} crediti, sopra il tuo target di ${item.sellTarget.toLocaleString('it-IT')}.`,
          at: now,
          playerId: item.id,
        }),
      )
    }
  }

  // 2. Carte in magazzino che hanno raggiunto il margine voluto.
  for (const position of positions) {
    if (position.sellPrice !== null) continue
    const price = quotes[position.playerId]?.price ?? 0
    if (!price || !position.buyPrice) continue
    const guadagno = profit(position.buyPrice, price, tax) * position.quantity
    const percentuale = (profit(position.buyPrice, price, tax) / position.buyPrice) * 100
    if (percentuale >= margin) {
      out.push(
        alert({
          id: `chiudi:${position.id}:${dayKey(now)}:${bucket(price)}`,
          kind: 'vendi',
          severity: 'buona',
          title: `${position.name}: puoi chiudere in utile`,
          body: `Vendendo ora incassi ${Math.round(guadagno).toLocaleString('it-IT')} crediti netti (+${Math.round(percentuale)}%).`,
          at: now,
          playerId: position.playerId || null,
        }),
      )
    }
  }

  // 2-bis. Verdetti di vendita: valgono più della sola soglia di margine,
  // perché tengono conto del picco di prezzo, delle SBC e del momento della
  // settimana. Si evita il doppione con la regola precedente.
  const giaAvvisati = new Set(out.filter((entry) => entry.kind === 'vendi').map((entry) => entry.playerId))
  for (const verdetto of sellVerdicts) {
    if (verdetto.action !== 'vendi-ora') continue
    const id = verdetto.player?.id ?? null
    if (giaAvvisati.has(id)) continue
    out.push(
      alert({
        id: `vendiora:${id}:${dayKey(now)}:${bucket(verdetto.askPrice)}`,
        kind: 'vendi',
        severity: 'urgente',
        title: `Momento di vendere: ${verdetto.player?.name ?? 'carta in rosa'}`,
        body: `${verdetto.reasons[0]?.label ?? 'Condizioni favorevoli'}. Mettendola a ${verdetto.askPrice.toLocaleString('it-IT')} incassi ${verdetto.netNow.toLocaleString('it-IT')} crediti netti.`,
        at: now,
        playerId: id,
      }),
    )
  }

  // 3. Occasioni con punteggio alto, purché non siano già in watchlist.
  const inLista = new Set(watchlist.map((item) => item.id))
  for (const opportunity of opportunities.slice(0, 5)) {
    if (opportunity.score < 75 || opportunity.action !== 'compra') continue
    if (inLista.has(opportunity.player.id)) continue
    out.push(
      alert({
        id: `occasione:${opportunity.player.id}:${dayKey(now)}`,
        kind: 'occasione',
        severity: 'buona',
        title: `Occasione: ${opportunity.player.name}`,
        body: `${opportunity.reasons[0]?.label ?? 'Segnali favorevoli'}. Compra entro ${opportunity.buyBelow.toLocaleString('it-IT')} crediti.`,
        at: now,
        playerId: opportunity.player.id,
      }),
    )
  }

  // 4. Finestra del ciclo settimanale appena aperta.
  if (phase && phase.bias >= 3) {
    out.push(
      alert({
        id: `finestra:${phase.id}:${dayKey(now)}`,
        kind: 'finestra',
        severity: 'info',
        title: `Finestra di acquisto: ${phase.label.toLowerCase()}`,
        body: phase.advice,
        at: now,
      }),
    )
  }

  // 5. Evento importante entro tre ore.
  for (const event of events) {
    const mancano = event.at - now
    if (mancano > 0 && mancano <= 3 * 3_600_000) {
      const ore = Math.max(1, Math.round(mancano / 3_600_000))
      out.push(
        alert({
          id: `evento:${event.label}:${dayKey(event.at)}`,
          kind: 'finestra',
          severity: 'info',
          title: `Fra circa ${ore} ${ore === 1 ? 'ora' : 'ore'}: ${event.label.toLowerCase()}`,
          body: event.detail,
          at: now,
        }),
      )
    }
  }

  return out
}
