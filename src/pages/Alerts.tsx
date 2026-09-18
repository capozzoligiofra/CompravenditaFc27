import { useState } from 'react'

import { Card, CardTitle, EmptyState, Pill, buttonClass } from '../components/ui.tsx'
import { dateTime } from '../lib/format.ts'
import { askNotificationPermission, notificationPermission } from '../lib/notifications.ts'
import { useStore } from '../lib/useStore.ts'
import type { AlertSeverity } from '../types.ts'

const TONE: Record<AlertSeverity, 'gain' | 'loss' | 'flag' | 'neutral'> = {
  urgente: 'gain',
  buona: 'flag',
  info: 'neutral',
}

export default function Alerts() {
  const { data, settings, updateSettings, markAlertsRead, removeAlert, clearAlerts } = useStore()
  const [permission, setPermission] = useState(() => notificationPermission())

  const enableNotifications = async () => {
    const ok = await askNotificationPermission()
    setPermission(notificationPermission())
    updateSettings({ notifications: ok })
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardTitle hint="Gli avvisi nascono dai tuoi target, dalle carte in magazzino e dal calendario del mercato.">
          Notifiche
        </CardTitle>
        {permission === 'non-supportate' ? (
          <p className="text-sm text-chalk-dim">Questo browser non supporta le notifiche: gli avvisi restano qui.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={settings.notifications && permission === 'granted' ? 'gain' : 'neutral'}>
              {permission === 'granted' ? (settings.notifications ? 'attive' : 'consentite ma spente') : 'spente'}
            </Pill>
            {permission === 'granted' ? (
              <button
                type="button"
                className={buttonClass}
                onClick={() => updateSettings({ notifications: !settings.notifications })}
              >
                {settings.notifications ? 'Spegni notifiche' : 'Accendi notifiche'}
              </button>
            ) : (
              <button type="button" className={buttonClass} onClick={() => void enableNotifications()}>
                Consenti notifiche
              </button>
            )}
          </div>
        )}
        <p className="mt-2 text-xs text-chalk-dim">
          Senza un server che le spinga, le notifiche arrivano solo mentre l'app è aperta, anche in secondo piano. Se
          l'app è chiusa gli avvisi ti aspettano qui.
        </p>
      </Card>

      {data.alerts.length === 0 ? (
        <EmptyState title="Nessun avviso">
          Imposta i target nella watchlist e registra gli acquisti: quando un prezzo scende al tuo livello, una carta
          va in utile o si apre una finestra del calendario, lo trovi qui.
        </EmptyState>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={buttonClass} onClick={markAlertsRead}>
              Segna tutti come letti
            </button>
            <button type="button" className={buttonClass} onClick={clearAlerts}>
              Svuota
            </button>
          </div>
          <ul className="space-y-2">
            {data.alerts.map((alert) => (
              <li key={alert.id}>
                <Card className={alert.read ? 'opacity-70' : ''}>
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill tone={TONE[alert.severity]}>{alert.kind}</Pill>
                    <span className="min-w-0 flex-1 text-sm font-semibold">{alert.title}</span>
                    <span className="font-mono text-[11px] text-chalk-dim">{dateTime(alert.at)}</span>
                  </div>
                  <p className="mt-1 text-sm text-chalk-dim">{alert.body}</p>
                  <button
                    type="button"
                    className="mt-2 text-xs text-chalk-dim hover:text-loss"
                    onClick={() => removeAlert(alert.id)}
                  >
                    elimina
                  </button>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
