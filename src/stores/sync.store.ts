import { create } from 'zustand';

type SyncState = {
  pendingCount: number;
  isSyncing: boolean;
  setPendingCount: (count: number) => void;
  setSyncing: (syncing: boolean) => void;
};

export const useSyncStore = create<SyncState>((set) => ({
  pendingCount: 0,
  isSyncing: false,
  setPendingCount: (count) => set({ pendingCount: count }),
  setSyncing: (syncing) => set({ isSyncing: syncing }),
}));
