import NetInfo from '@react-native-community/netinfo';
import { onlineManager, QueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { useConnectivityStore } from '@/stores/connectivity.store';
import { captureBreadcrumb } from '@/lib/sentry';

let onlineManagerAttached = false;

function attachOnlineManager(): void {
  if (onlineManagerAttached) return;
  onlineManagerAttached = true;
  onlineManager.setEventListener((setOnline) => {
    return NetInfo.addEventListener((state) => {
      setOnline(Boolean(state.isConnected));
    });
  });
}

export function useNetworkStatus(
  queryClient?: QueryClient,
): { isOnline: boolean } {
  const isOnline = useConnectivityStore((state) => state.isOnline);
  const setOnline = useConnectivityStore((state) => state.setOnline);
  const wasOffline = useRef(false);

  useEffect(() => {
    attachOnlineManager();

    let cancelled = false;
    NetInfo.fetch().then((state) => {
      if (!cancelled) {
        const connected = Boolean(state.isConnected);
        setOnline(connected);
        wasOffline.current = !connected;
      }
    });

    const unsubscribe = NetInfo.addEventListener((state) => {
      const connected = Boolean(state.isConnected);
      setOnline(connected);

      if (connected && wasOffline.current && queryClient) {
        captureBreadcrumb('network', 'Reconnected — invalidating all queries');
        void queryClient.invalidateQueries();
      }
      wasOffline.current = !connected;
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [setOnline, queryClient]);

  return { isOnline };
}
