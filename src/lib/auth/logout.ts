import { type QueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';

import { clearAll, getPendingCount } from '@/lib/offline/outbox';
import { supabase } from '@/lib/supabase/client';
import { useSessionStore } from '@/stores/session.store';
import { useSyncStore } from '@/stores/sync.store';
import { removeCurrentToken } from '@/lib/notifications/register';
import { useNotificationStore } from '@/stores/notification.store';

export async function logout(queryClient: QueryClient): Promise<void> {
  await removeCurrentToken();
  await supabase.auth.signOut().catch(() => undefined);
  try {
    await clearAll();
  } catch {
    // ignore — best effort
  }
  queryClient.clear();
  useSyncStore.getState().setPendingCount(0);
  useNotificationStore.getState().clearUnread();
  useSessionStore.getState().clearSession();
}

export function logoutWithGuard(queryClient: QueryClient): void {
  void getPendingCount()
    .then((count) => {
      if (count > 0) {
        Alert.alert(
          'Acoes pendentes',
          `Ainda ha ${count} ${count === 1 ? 'acao pendente' : 'acoes pendentes'}. Sair vai descarta-las. Continuar?`,
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Sair mesmo assim',
              style: 'destructive',
              onPress: () => {
                void logout(queryClient);
              },
            },
          ],
        );
        return;
      }
      void logout(queryClient);
    })
    .catch(() => {
      void logout(queryClient);
    });
}
