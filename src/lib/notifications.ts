import type { Alert } from '../types.ts'

/**
 * Avvisi del browser. Senza un server che spinga le notifiche arrivano solo
 * mentre l'app è aperta (anche in secondo piano): è un limite reale, scritto
 * anche nelle impostazioni.
 */
export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function notificationPermission(): NotificationPermission | 'non-supportate' {
  if (!notificationsSupported()) return 'non-supportate'
  return Notification.permission
}

export async function askNotificationPermission(): Promise<boolean> {
  if (!notificationsSupported()) return false
  if (Notification.permission === 'granted') return true
  const result = await Notification.requestPermission()
  return result === 'granted'
}

export async function notifyAlerts(alerts: Alert[]): Promise<void> {
  if (!notificationsSupported() || Notification.permission !== 'granted') return
  // Uno alla volta e al massimo tre: una raffica di notifiche è solo fastidio.
  for (const alert of alerts.filter((entry) => entry.severity !== 'info').slice(0, 3)) {
    try {
      const registration = await navigator.serviceWorker?.getRegistration()
      if (registration) {
        await registration.showNotification(alert.title, { body: alert.body, tag: alert.id })
      } else {
        new Notification(alert.title, { body: alert.body, tag: alert.id })
      }
    } catch {
      // Notifica non mostrabile: l'avviso resta comunque in pagina.
    }
  }
}
