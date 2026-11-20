import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { state } from './store';

/** Programa (o cancela) el recordatorio diario según los ajustes. Devuelve false si falta permiso. */
export async function applyReminder(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return true;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: 1 }] });
    if (!state.settings.reminderOn) return true;
    const perm = await LocalNotifications.requestPermissions();
    if (perm.display !== 'granted') return false;
    const [hour, minute] = state.settings.reminderTime.split(':').map(Number);
    await LocalNotifications.schedule({
      notifications: [
        {
          id: 1,
          title: 'SMR English',
          body: 'Unos minutos de inglés hoy. ¡Mantén la racha!',
          schedule: { on: { hour, minute }, allowWhileIdle: true },
        },
      ],
    });
    return true;
  } catch {
    return false;
  }
}
