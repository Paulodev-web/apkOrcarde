import type { Router } from 'expo-router';

import { captureBreadcrumb } from '@/lib/sentry';
import { useNotificationStore } from '@/stores/notification.store';
import { resolveDeepLink } from './links';
import { getNotificationsModule } from './native';

type NotificationSubscription = { remove(): void };

let receiveSub: NotificationSubscription | null = null;
let responseSub: NotificationSubscription | null = null;

export function setupNotificationHandlers(router: Router): () => void {
  const Notifications = getNotificationsModule('listeners');
  if (!Notifications) {
    return () => undefined;
  }

  receiveSub = Notifications.addNotificationReceivedListener(() => {
    useNotificationStore.getState().incrementUnread();
  });

  responseSub = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const data = response.notification.request.content.data as
        | Record<string, unknown>
        | undefined;
      const linkPath =
        typeof data?.linkPath === 'string' ? data.linkPath : null;

      captureBreadcrumb('push', `Tap on notification, linkPath=${linkPath ?? 'null'}`);

      if (linkPath) {
        const resolved = resolveDeepLink(linkPath);
        if (resolved) {
          router.push(resolved as never);
          return;
        }
      }
      router.push('/(main)/' as never);
    },
  );

  return () => {
    receiveSub?.remove();
    responseSub?.remove();
    receiveSub = null;
    responseSub = null;
  };
}
