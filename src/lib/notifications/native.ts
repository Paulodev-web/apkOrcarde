import { requireOptionalNativeModule } from 'expo-modules-core';

import { captureBreadcrumb } from '@/lib/sentry';

type NotificationsModule = typeof import('expo-notifications');
type NotificationsCapability = 'channel' | 'listeners' | 'registration';

const REQUIRED_NATIVE_MODULES: Record<NotificationsCapability, string[]> = {
  channel: ['ExpoPushTokenManager', 'ExpoNotificationChannelManager'],
  listeners: ['ExpoPushTokenManager', 'ExpoNotificationsEmitter'],
  registration: [
    'ExpoNotificationPermissionsModule',
    'ExpoPushTokenManager',
    'NotificationsServerRegistrationModule',
  ],
};

const cachedModules = new Map<NotificationsCapability, NotificationsModule | null>();
const warnedCapabilities = new Set<NotificationsCapability>();

export function getNotificationsModule(
  capability: NotificationsCapability,
): NotificationsModule | null {
  if (cachedModules.has(capability)) {
    return cachedModules.get(capability) ?? null;
  }

  const missingNativeModules = REQUIRED_NATIVE_MODULES[capability].filter(
    (moduleName) => requireOptionalNativeModule(moduleName) == null,
  );

  if (missingNativeModules.length > 0) {
    cachedModules.set(capability, null);

    if (!warnedCapabilities.has(capability)) {
      warnedCapabilities.add(capability);
      captureBreadcrumb(
        'push',
        `Skipping ${capability}: missing native modules ${missingNativeModules.join(', ')}`,
        { capability, missingNativeModules },
        'warning',
      );
    }

    return null;
  }

  try {
    const module = require('expo-notifications') as NotificationsModule;
    cachedModules.set(capability, module);
    return module;
  } catch (error) {
    cachedModules.set(capability, null);

    if (!warnedCapabilities.has(capability)) {
      warnedCapabilities.add(capability);
      const message = error instanceof Error ? error.message : 'Unknown error';
      captureBreadcrumb(
        'push',
        `expo-notifications unavailable for ${capability}: ${message}`,
        undefined,
        'warning',
      );
    }

    return null;
  }
}
