import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { captureBreadcrumb, captureException } from '@/lib/sentry';
import { supabase } from '@/lib/supabase/client';
import { getNotificationsModule } from './native';

let cachedToken: string | null = null;

export async function registerForPushNotifications(
  userId: string,
): Promise<string | null> {
  try {
    const Notifications = getNotificationsModule('registration');
    if (!Notifications) {
      captureBreadcrumb('push', 'Skipping push registration: native module unavailable');
      return null;
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      captureBreadcrumb('push', 'Permission denied by user');
      return null;
    }

    const expoExtra = Constants.expoConfig?.extra as
      | { eas?: { projectId?: string } }
      | undefined;
    const projectId = expoExtra?.eas?.projectId ?? Constants.easConfig?.projectId;

    if (!projectId) {
      captureBreadcrumb('push', 'Missing EAS projectId — cannot register token');
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;

    await supabase.from('device_tokens').upsert(
      {
        user_id: userId,
        token,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'token' },
    );

    cachedToken = token;
    captureBreadcrumb('push', `Token registered: ${token.slice(0, 20)}...`);
    return token;
  } catch (err) {
    captureException(err);
    return null;
  }
}

export async function refreshLastSeen(userId: string): Promise<void> {
  if (!cachedToken) return;
  try {
    await supabase
      .from('device_tokens')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('token', cachedToken);
  } catch {
    // best effort
  }
}

export async function removeCurrentToken(): Promise<void> {
  if (!cachedToken) return;
  try {
    await supabase.from('device_tokens').delete().eq('token', cachedToken);
    captureBreadcrumb('push', 'Token removed on logout');
  } catch {
    // best effort
  } finally {
    cachedToken = null;
  }
}

export function getCachedToken(): string | null {
  return cachedToken;
}
