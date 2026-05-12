import { create } from 'zustand';

type ConnectivityState = {
  isOnline: boolean;
  isRealtimeConnected: boolean;
  setOnline: (online: boolean) => void;
  setRealtimeConnected: (connected: boolean) => void;
};

export const useConnectivityStore = create<ConnectivityState>((set) => ({
  isOnline: true,
  isRealtimeConnected: false,
  setOnline: (online) => set({ isOnline: online }),
  setRealtimeConnected: (connected) => set({ isRealtimeConnected: connected }),
}));
