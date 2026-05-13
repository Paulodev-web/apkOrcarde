import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

let initialized = false;

export function initSentry(): typeof Sentry | null {
  if (initialized) return Sentry;

  const extra = Constants.expoConfig?.extra ?? {};
  const dsn = (extra.sentryDsn as string | undefined) ?? process.env.EXPO_PUBLIC_SENTRY_DSN;

  if (!dsn || dsn.trim().length === 0) {
    return null;
  }

  Sentry.init({
    dsn,
    enableAutoSessionTracking: true,
    sendDefaultPii: false,
    debug: false,
  });

  initialized = true;
  return Sentry;
}

export function captureBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, unknown>,
  level: 'info' | 'warning' | 'error' = 'info',
): void {
  if (!initialized) return;
  Sentry.addBreadcrumb({ category, message, data, level });
}

export function captureException(error: unknown): void {
  if (!initialized) return;
  Sentry.captureException(error);
}
