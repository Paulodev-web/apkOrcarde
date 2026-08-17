import * as Sentry from '@sentry/react-native';

import { getPublicEnvConfig } from '@/lib/env';

let initialized = false;

export function initSentry(): typeof Sentry | null {
  if (initialized) return Sentry;

  const dsn = getPublicEnvConfig()?.sentryDsn;

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
