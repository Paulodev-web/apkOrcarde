import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { getPublicEnvConfig } from '@/lib/env';

const publicEnv = getPublicEnvConfig();

if (!publicEnv) {
  throw new Error(
    'Supabase credentials are missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY for the EAS production environment and rebuild.',
  );
}

const { supabaseUrl, supabaseAnonKey } = publicEnv;

const isWebEnv = Platform.OS === 'web';

const adapter = {
  async getItem(key: string): Promise<string | null> {
    if (isWebEnv) {
      return AsyncStorage.getItem(key);
    }

    try {
      const value = await SecureStore.getItemAsync(key);
      if (value !== null) return value;
    } catch {
      // SecureStore unavailable or read failed; fall through to AsyncStorage
    }

    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    if (isWebEnv) {
      await AsyncStorage.setItem(key, value);
      return;
    }

    try {
      await SecureStore.setItemAsync(key, value);
      try {
        await AsyncStorage.removeItem(key);
      } catch {
        // ignore: best-effort cleanup of stale fallback copy
      }
      return;
    } catch {
      // SecureStore failed (likely value > 2KB limit); fall back to AsyncStorage
      try {
        await AsyncStorage.setItem(key, value);
      } catch {
        // last-resort: swallow to avoid crashing the auth pipeline
      }
    }
  },

  async removeItem(key: string): Promise<void> {
    if (isWebEnv) {
      await AsyncStorage.removeItem(key);
      return;
    }

    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // ignore
    }
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: adapter,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
