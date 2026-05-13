import { Platform } from 'react-native';
import { getNotificationsModule } from './native';

export async function setupAndroidNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const Notifications = getNotificationsModule('channel');
  if (!Notifications) return;

  await Notifications.setNotificationChannelAsync('default', {
    name: 'Notificacoes',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF6B35',
  });
}
