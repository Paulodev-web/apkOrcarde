import Constants from 'expo-constants';

export type PublicEnvConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  sentryDsn: string | undefined;
};

function readExtraRecord(): Record<string, unknown> {
  const expoExtra = Constants.expoConfig?.extra;
  if (expoExtra && typeof expoExtra === 'object') {
    return expoExtra as Record<string, unknown>;
  }

  const manifest2Extra = (
    Constants.manifest2 as { extra?: { expoClient?: { extra?: Record<string, unknown> } } } | null
  )?.extra?.expoClient?.extra;
  if (manifest2Extra && typeof manifest2Extra === 'object') {
    return manifest2Extra;
  }

  const legacyExtra = (Constants.manifest as { extra?: Record<string, unknown> } | null)?.extra;
  if (legacyExtra && typeof legacyExtra === 'object') {
    return legacyExtra;
  }

  return {};
}

function pickString(...candidates: Array<string | undefined>): string | undefined {
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

/** Resolves EXPO_PUBLIC_* from the JS bundle and app manifest extra (EAS embeds both when configured). */
export function getPublicEnvConfig(): PublicEnvConfig | null {
  const extra = readExtraRecord();

  const supabaseUrl = pickString(
    process.env.EXPO_PUBLIC_SUPABASE_URL,
    extra.supabaseUrl as string | undefined,
  );
  const supabaseAnonKey = pickString(
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    extra.supabaseAnonKey as string | undefined,
  );
  const sentryDsn = pickString(
    process.env.EXPO_PUBLIC_SENTRY_DSN,
    extra.sentryDsn as string | undefined,
  );

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return { supabaseUrl, supabaseAnonKey, sentryDsn };
}

export const missingPublicEnvMessage =
  'Configuracao do app incompleta: variaveis EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_ANON_KEY nao foram embutidas no build. No EAS, confira Environment variables (ambiente production) e adicione "environment": "production" no perfil em eas.json, depois gere um APK novo.';
