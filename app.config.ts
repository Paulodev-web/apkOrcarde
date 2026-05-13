import type { ExpoConfig } from 'expo/config';

type AppVariant = 'development' | 'preview' | 'production';

const appVariant = (process.env.APP_VARIANT as AppVariant | undefined) ?? 'production';
const easProjectId =
  process.env.EAS_PROJECT_ID || '2e2796fb-37d7-4b9d-add9-7fe09ec203cf';

const variantConfig: Record<AppVariant, { appName: string; packageName: string }> = {
  development: {
    appName: 'OrcaRede Manager (Dev)',
    packageName: 'com.orcarede.manager.dev',
  },
  preview: {
    appName: 'OrcaRede Manager (Preview)',
    packageName: 'com.orcarede.manager.preview',
  },
  production: {
    appName: 'OrcaRede Manager',
    packageName: 'com.orcarede.manager',
  },
};

const config: ExpoConfig = {
  name: variantConfig[appVariant].appName,
  owner: 'devpaulo',
  slug: 'orcarede-apk',
  version: '1.0.0',
  runtimeVersion: {
    policy: 'appVersion',
  },
  orientation: 'portrait',
  scheme: 'orcarede',
  userInterfaceStyle: 'light',
  icon: './assets/icon.png',
  ...(easProjectId
    ? {
        updates: {
          url: `https://u.expo.dev/${easProjectId}`,
        },
      }
    : {}),
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#FFFFFF',
  },
  assetBundlePatterns: ['**/*'],
  android: {
    package: variantConfig[appVariant].packageName,
    versionCode: 1,
    adaptiveIcon: {
      foregroundImage: './assets/icon.png',
      backgroundColor: '#0a3a82',
    },
    permissions: [
      'INTERNET',
      'ACCESS_NETWORK_STATE',
      'CAMERA',
      'READ_EXTERNAL_STORAGE',
      'WRITE_EXTERNAL_STORAGE',
      'READ_MEDIA_IMAGES',
      'READ_MEDIA_VIDEO',
      'RECORD_AUDIO',
      'ACCESS_FINE_LOCATION',
      'ACCESS_COARSE_LOCATION',
      'POST_NOTIFICATIONS',
    ],
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: variantConfig[appVariant].packageName,
  },
  web: {
    bundler: 'metro',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-sqlite',
    [
      'expo-image-picker',
      {
        photosPermission: 'O app precisa acessar suas fotos para enviar no chat.',
        cameraPermission: 'O app precisa acessar a camera para tirar fotos.',
      },
    ],
    'expo-av',
    [
      'expo-location',
      {
        locationWhenInUsePermission: 'O app usa sua localizacao para registrar onde postes foram instalados.',
      },
    ],
    [
      'expo-notifications',
      {
        sounds: [],
      },
    ],
    '@config-plugins/react-native-blob-util',
    '@config-plugins/react-native-pdf',
    [
      'expo-build-properties',
      {
        android: {
          minSdkVersion: 26,
          compileSdkVersion: 36,
          targetSdkVersion: 35,
        },
      },
    ],
    [
      '@sentry/react-native/expo',
      {
        url: 'https://sentry.io/',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    appVariant,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    eas: {
      projectId: easProjectId,
    },
  },
};

export default config;
