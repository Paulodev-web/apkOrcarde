import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useConnectivityStore } from '@/stores/connectivity.store';

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

export function useNetworkStatus(): { isOnline: boolean } {
  const isOnline = useConnectivityStore((state) => state.isOnline);
  const setOnline = useConnectivityStore((state) => state.setOnline);

  useEffect(() => {
    attachOnlineManager();

    let cancelled = false;
    NetInfo.fetch().then((state) => {
      if (!cancelled) setOnline(Boolean(state.isConnected));
    });

    const unsubscribe = NetInfo.addEventListener((state) => {
      setOnline(Boolean(state.isConnected));
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [setOnline]);

  return { isOnline };
}
