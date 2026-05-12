import { create } from 'zustand';

import type { ProfileRole, SessionUser } from '@/types';

type SessionState = {
  user: SessionUser | null;
  role: ProfileRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  mustChangePassword: boolean;
  setSession: (input: { user: SessionUser; role: ProfileRole; mustChangePassword: boolean }) => void;
  updateUserProfile: (input: Partial<SessionUser>) => void;
  setMustChangePassword: (value: boolean) => void;
  clearSession: () => void;
  setLoading: (loading: boolean) => void;
};

export const useSessionStore = create<SessionState>((set) => ({
  user: null,
  role: null,
  isAuthenticated: false,
  isLoading: true,
  mustChangePassword: false,
  setSession: ({ user, role, mustChangePassword }) =>
    set({
      user,
      role,
      mustChangePassword,
      isAuthenticated: true,
      isLoading: false,
    }),
  updateUserProfile: (input) =>
    set((state) => (state.user ? { user: { ...state.user, ...input } } : state)),
  setMustChangePassword: (value) => set({ mustChangePassword: value }),
  clearSession: () =>
    set({
      user: null,
      role: null,
      isAuthenticated: false,
      isLoading: false,
      mustChangePassword: false,
    }),
  setLoading: (loading) => set({ isLoading: loading }),
}));
