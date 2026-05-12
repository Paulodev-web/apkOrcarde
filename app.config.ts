import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'OrcaRede Manager',
  slug: 'orcarede-apk',
  version: '0.1.0',
  orientation: 'portrait',
  scheme: 'orcarede',
  userInterfaceStyle: 'light',
  assetBundlePatterns: ['**/*'],
  android: {
    package: 'com.orcarede.manager',
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
    ],
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.orcarede.manager',
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
    '@config-plugins/react-native-blob-util',
    '@config-plugins/react-native-pdf',
    [
      'expo-build-properties',
      {
        android: {
          minSdkVersion: 26,
          compileSdkVersion: 35,
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
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    eas: {
      projectId: process.env.EAS_PROJECT_ID,
    },
  },
};

export default config;
