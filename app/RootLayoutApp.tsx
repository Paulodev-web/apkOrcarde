/* eslint-disable import/no-duplicates -- react-native-gesture-handler: side-effect + named imports from same entry */
import 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
/* eslint-enable import/no-duplicates */

import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, AppState, type AppStateStatus, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors } from '@/design-system/tokens/colors';
import {
  clearCachedProfile,
  readCachedProfile,
  saveCachedProfile,
} from '@/lib/auth/profile-cache';
import { hasApkAccess, loadProfileForLoggedInUser } from '@/lib/auth/session';
import { startSyncWorker } from '@/lib/offline/sync-worker';
import { initSentry } from '@/lib/sentry';
import { supabase } from '@/lib/supabase/client';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useConnectivityStore } from '@/stores/connectivity.store';
import { useSessionStore } from '@/stores/session.store';
import { QUERY_DEFAULTS } from '@/constants/limits';
import { setupAndroidNotificationChannel } from '@/lib/notifications/channel';
import { registerForPushNotifications, refreshLastSeen } from '@/lib/notifications/register';
import { setupNotificationHandlers } from '@/lib/notifications/handlers';

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

/**
 * Encerra a sessao de verdade — usar somente quando o servidor confirmou que a
 * conta nao serve mais. Falta de sinal nunca deve chegar aqui: o refresh token
 * precisa sobreviver ao dia inteiro sem rede.
 */
async function endSessionForGood(): Promise<void> {
  await supabase.auth.signOut().catch(() => undefined);
  await clearCachedProfile().catch(() => undefined);
}

export default function RootLayoutApp() {
  const queryClientRef = useRef<QueryClient | null>(null);
  if (!queryClientRef.current) {
    queryClientRef.current = makeQueryClient();
  }
  const queryClient = queryClientRef.current;

  useNetworkStatus(queryClient);
  useAuthHydration();
  useProfileRevalidation();
  useAuthGuard();
  const router = useRouter();

  const isAuthenticated = useSessionStore((s) => s.isAuthenticated);
  const userId = useSessionStore((s) => s.user?.id ?? '');

  useEffect(() => {
    if (!isAuthenticated) return;
    const stop = startSyncWorker();
    return stop;
  }, [isAuthenticated]);

  useEffect(() => {
    void setupAndroidNotificationChannel();
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !userId) return;
    void registerForPushNotifications(userId);
    const cleanup = setupNotificationHandlers(router);
    return cleanup;
  }, [isAuthenticated, userId, router]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (status) => {
      onAppStateChange(status);
      if (status === 'active' && userId) {
        void refreshLastSeen(userId);
      }
    });
    return () => sub.remove();
  }, [userId]);

  const isLoading = useSessionStore((s) => s.isLoading);

  return (
    <GestureHandlerRootView style={styles.flex}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <BottomSheetModalProvider>
            <StatusBar style="dark" />
            {isLoading ? <SplashLoader /> : <Slot />}
          </BottomSheetModalProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

function SplashLoader() {
  return (
    <View style={styles.splash}>
      <ActivityIndicator size="large" color={colors.primary} />
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
      // `getSession` le do armazenamento local: funciona sem rede.
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session || !data.session.user) {
        clearSession();
        setLoading(false);
        return;
      }

      const authUser = data.session.user;
      const uid = authUser.id;
      const email = authUser.email ?? '';
      const meta = (authUser.user_metadata ?? {}) as Record<string, unknown>;
      const mustChangePassword = meta.must_change_password === true;

      const profileResult = await loadProfileForLoggedInUser(uid);
      if (cancelled) return;

      if (profileResult.success) {
        const profile = profileResult.data;
        if (!hasApkAccess(profile.role) || !profile.is_active) {
          await endSessionForGood();
          if (cancelled) return;
          clearSession();
          setLoading(false);
          return;
        }
        void saveCachedProfile(profile);
        setSession({
          user: { id: uid, email, fullName: profile.full_name },
          role: profile.role,
          mustChangePassword,
        });
        return;
      }

      // Sem rede: a sessao continua valida, so nao deu para confirmar o perfil
      // agora. Entra com o que ficou guardado da ultima vez que houve sinal —
      // e o caso do canteiro, e deslogar aqui prenderia o responsavel do lado
      // de fora, sem conseguir nem logar de novo.
      if (profileResult.code === 'offline') {
        const cached = await readCachedProfile(uid);
        if (cancelled) return;
        if (cached && hasApkAccess(cached.role) && cached.is_active) {
          setSession({
            user: { id: uid, email, fullName: cached.full_name },
            role: cached.role,
            mustChangePassword,
          });
          return;
        }
        // Sem perfil guardado nao da para saber o papel. Manda para o login,
        // mas NAO chama signOut: o refresh token precisa sobreviver para ele
        // conseguir entrar assim que houver sinal.
        clearSession();
        setLoading(false);
        return;
      }

      // O servidor respondeu e o problema e real (perfil inexistente, conta
      // removida). Aqui sim encerra de vez.
      await endSessionForGood();
      if (cancelled) return;
      clearSession();
      setLoading(false);
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

/**
 * Reconfere o perfil quando a rede volta.
 *
 * Enquanto esteve sem sinal, o app confiou no perfil guardado no aparelho.
 * Assim que ha conexao, confirma com o servidor — e aqui que o app descobre
 * que a conta foi desativada durante o periodo offline. Roda em segundo plano:
 * nunca bloqueia a tela nem interrompe quem esta registrando algo.
 */
function useProfileRevalidation(): void {
  const isOnline = useConnectivityStore((s) => s.isOnline);
  const isAuthenticated = useSessionStore((s) => s.isAuthenticated);
  const userId = useSessionStore((s) => s.user?.id ?? '');
  const updateUserProfile = useSessionStore((s) => s.updateUserProfile);
  const clearSession = useSessionStore((s) => s.clearSession);

  useEffect(() => {
    if (!isOnline || !isAuthenticated || !userId) return;
    let cancelled = false;

    void (async () => {
      const result = await loadProfileForLoggedInUser(userId);
      if (cancelled) return;
      // Falhou de novo (a rede pode ter caido no meio): mantem o que ja esta
      // valendo. A proxima reconexao tenta outra vez.
      if (!result.success) return;

      const profile = result.data;
      if (!hasApkAccess(profile.role) || !profile.is_active) {
        await endSessionForGood();
        if (cancelled) return;
        clearSession();
        return;
      }

      void saveCachedProfile(profile);
      updateUserProfile({ fullName: profile.full_name });
    })();

    return () => {
      cancelled = true;
    };
  }, [isOnline, isAuthenticated, userId, updateUserProfile, clearSession]);
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
    if (!isAuthenticated || !role || !hasApkAccess(role)) return '/(auth)/login';
    if (mustChangePassword) return '/(auth)/change-password';
    return '/(main)';
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
    if (target === '/(main)') {
      if (!inMainGroup) {
        router.replace('/(main)');
      }
    }
  }, [router, segments, target]);
}

type TargetRoute = '/(auth)/login' | '/(auth)/change-password' | '/(main)' | null;

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
});
