import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, type AppStateStatus, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { loadProfileForLoggedInUser } from '@/lib/auth/session';
import { startSyncWorker } from '@/lib/offline/sync-worker';
import { initSentry } from '@/lib/sentry';
import { supabase } from '@/lib/supabase/client';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useSessionStore } from '@/stores/session.store';
import { QUERY_DEFAULTS } from '@/constants/limits';

initSentry();

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: QUERY_DEFAULTS.STALE_TIME_MS,
        retry: QUERY_DEFAULTS.RETRY_COUNT,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        networkMode: 'online',
      },
      mutations: {
        retry: 0,
        networkMode: 'online',
      },
    },
  });
}

function onAppStateChange(status: AppStateStatus): void {
  focusManager.setFocused(status === 'active');
}

export default function RootLayout() {
  const queryClientRef = useRef<QueryClient | null>(null);
  if (!queryClientRef.current) {
    queryClientRef.current = makeQueryClient();
  }
  const queryClient = queryClientRef.current;

  useNetworkStatus();
  useAuthHydration();
  useAuthGuard();

  const isAuthenticated = useSessionStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) return;
    const stop = startSyncWorker();
    return stop;
  }, [isAuthenticated]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', onAppStateChange);
    return () => sub.remove();
  }, []);

  const isLoading = useSessionStore((s) => s.isLoading);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        {isLoading ? <SplashLoader /> : <Slot />}
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}

function SplashLoader() {
  return (
    <View style={styles.splash}>
      <ActivityIndicator size="large" color="#0a3a82" />
    </View>
  );
}

function useAuthHydration(): void {
  const setSession = useSessionStore((s) => s.setSession);
  const setLoading = useSessionStore((s) => s.setLoading);
  const updateUserProfile = useSessionStore((s) => s.updateUserProfile);
  const setMustChangePassword = useSessionStore((s) => s.setMustChangePassword);
  const clearSession = useSessionStore((s) => s.clearSession);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session || !data.session.user) {
        clearSession();
        setLoading(false);
        return;
      }
      const userId = data.session.user.id;
      const profileResult = await loadProfileForLoggedInUser(userId);
      if (cancelled) return;
      if (!profileResult.success) {
        await supabase.auth.signOut().catch(() => undefined);
        clearSession();
        setLoading(false);
        return;
      }
      const profile = profileResult.data;
      if (profile.role !== 'manager' || !profile.is_active) {
        await supabase.auth.signOut().catch(() => undefined);
        clearSession();
        setLoading(false);
        return;
      }
      const meta = (data.session.user.user_metadata ?? {}) as Record<string, unknown>;
      setSession({
        user: {
          id: userId,
          email: data.session.user.email ?? '',
          fullName: profile.full_name,
        },
        role: 'manager',
        mustChangePassword: meta.must_change_password === true,
      });
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        clearSession();
        return;
      }

      if (event === 'TOKEN_REFRESHED') {
        return;
      }

      if (event === 'USER_UPDATED' && session?.user) {
        const meta = (session.user.user_metadata ?? {}) as Record<string, unknown>;
        setMustChangePassword(meta.must_change_password === true);
        updateUserProfile({ email: session.user.email ?? '' });
        return;
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [clearSession, setLoading, setMustChangePassword, setSession, updateUserProfile]);
}

function useAuthGuard(): void {
  const router = useRouter();
  const segments = useSegments();
  const isLoading = useSessionStore((s) => s.isLoading);
  const isAuthenticated = useSessionStore((s) => s.isAuthenticated);
  const role = useSessionStore((s) => s.role);
  const mustChangePassword = useSessionStore((s) => s.mustChangePassword);

  const target = useMemo<TargetRoute>(() => {
    if (isLoading) return null;
    if (!isAuthenticated || role !== 'manager') return '/(auth)/login';
    if (mustChangePassword) return '/(auth)/change-password';
    return '/(main)/';
  }, [isLoading, isAuthenticated, role, mustChangePassword]);

  useEffect(() => {
    if (target === null) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inMainGroup = segments[0] === '(main)';
    const currentLeaf = segments[segments.length - 1];

    if (target === '/(auth)/login') {
      if (!(inAuthGroup && currentLeaf === 'login')) {
        router.replace('/(auth)/login');
      }
      return;
    }
    if (target === '/(auth)/change-password') {
      if (!(inAuthGroup && currentLeaf === 'change-password')) {
        router.replace('/(auth)/change-password');
      }
      return;
    }
    if (target === '/(main)/') {
      if (!inMainGroup) {
        router.replace('/(main)/');
      }
    }
  }, [router, segments, target]);
}

type TargetRoute = '/(auth)/login' | '/(auth)/change-password' | '/(main)/' | null;

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
});
