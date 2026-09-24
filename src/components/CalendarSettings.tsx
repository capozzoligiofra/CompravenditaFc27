import { APPUNTAMENTI, CALENDARIO_PREDEFINITO, normalizzaCalendario, romeParts } from '../../shared/calendar.mjs'
import type { Calendario, ChiaveAppuntamento } from '../../shared/calendar.d.mts'
import { Card, CardTitle, buttonClass } from './ui.tsx'
import { useStore } from '../lib/useStore.ts'

const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato']

/**
 * Gli orari della settimana, correggibili.
 *
 * È la parte dell'app che non può essere indovinata: EA cambia gli orari fra
 * un capitolo e l'altro — i premi Rivals sono stati per anni di lunedì e poi
 * sono passati al giovedì — e nessuna sorgente ce lo dice. Chi gioca però lo
 * sa al minuto: il pulsante «è appena successo» prende giorno e ora da
 * adesso, e da lì in poi fasi, conti alla rovescia e stime tornano giuste.
 */
export default function CalendarSettings() {
  const { settings, updateSettings } = useStore()
  const calendario = normalizzaCalendario(settings.calendar) as Calendario

  const aggiorna = (chiave: ChiaveAppuntamento, patch: { weekday?: number; hour?: number }) => {
    updateSettings({ calendar: { ...calendario, [chiave]: { ...calendario[chiave], ...patch } } })
  }

  const appenaSuccesso = (chiave: ChiaveAppuntamento) => {
    const { weekday, hour } = romeParts(new Date())
    aggiorna(chiave, { weekday, hour })
  }

  return (
    <Card>
      <CardTitle hint="Da questi orari nascono le fasi del mercato, i conti alla rovescia e il prezzo stimato. Se non tornano, correggili: EA li sposta e l'app non può saperlo da sola.">
        Orari della settimana
      </CardTitle>

      <ul className="space-y-3">
        {APPUNTAMENTI.map((voce) => (
          <li key={voce.chiave} className="rounded-xl border border-pitch-line bg-pitch/60 p-3">
            <p className="text-sm font-semibold">{voce.label}</p>
            <p className="mt-0.5 text-[11px] text-chalk-dim">{voce.detail}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select
                value={calendario[voce.chiave].weekday}
                onChange={(event) => aggiorna(voce.chiave, { weekday: Number(event.target.value) })}
                aria-label={`Giorno di ${voce.label}`}
                className="rounded-xl border border-pitch-line bg-pitch px-2 py-1.5 text-sm outline-none focus:border-gain/60"
              >
                {GIORNI.map((giorno, indice) => (
                  <option key={giorno} value={indice}>
                    {giorno}
                  </option>
                ))}
              </select>
              <select
                value={calendario[voce.chiave].hour}
                onChange={(event) => aggiorna(voce.chiave, { hour: Number(event.target.value) })}
                aria-label={`Ora di ${voce.label}`}
                className="rounded-xl border border-pitch-line bg-pitch px-2 py-1.5 font-mono text-sm outline-none focus:border-gain/60"
              >
                {Array.from({ length: 24 }, (_, ora) => (
                  <option key={ora} value={ora}>
                    {String(ora).padStart(2, '0')}:00
                  </option>
                ))}
              </select>
              <button type="button" className={buttonClass} onClick={() => appenaSuccesso(voce.chiave)}>
                È appena successo
              </button>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={buttonClass}
          onClick={() => updateSettings({ calendar: CALENDARIO_PREDEFINITO as Calendario })}
        >
          Rimetti gli orari di partenza
        </button>
        <span className="text-[11px] text-chalk-dim">Ora italiana. Gli orari ti seguono sugli altri dispositivi.</span>
      </div>
    </Card>
  )
}
