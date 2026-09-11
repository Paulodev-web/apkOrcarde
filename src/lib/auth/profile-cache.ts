/**
 * Perfil guardado no aparelho, para o app saber quem e a pessoa sem precisar
 * perguntar ao servidor.
 *
 * Existe por causa do canteiro: abrir o app sem sinal nao pode deslogar
 * ninguem. A sessao do Supabase ja e persistida pelo SDK, mas o perfil
 * (nome, papel, se esta ativo) vinha de uma consulta a `profiles` em toda
 * abertura — e sem rede essa consulta falha. Com o cache, a falha de rede
 * deixa de ser motivo para expulsar o usuario.
 *
 * O cache guarda o `id` junto e `readCachedProfile` so devolve o registro se
 * o id conferir. Assim, trocar de usuario no mesmo aparelho nunca reaproveita
 * o perfil do anterior.
 *
 * Nao e fonte de verdade: assim que houver rede, a hidratacao revalida contra
 * o servidor e sobrescreve o que estiver aqui.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Profile } from '@/types';

const CACHE_KEY = 'orcarede.auth.profile.v1';

export type CachedProfile = Profile & {
  /** ISO de quando o servidor confirmou estes dados pela ultima vez. */
  cachedAt: string;
};

function isProfileShape(value: unknown): value is CachedProfile {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.full_name === 'string' &&
    typeof v.role === 'string' &&
    typeof v.is_active === 'boolean'
  );
}

export async function saveCachedProfile(profile: Profile): Promise<void> {
  const payload: CachedProfile = { ...profile, cachedAt: new Date().toISOString() };
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Cache e otimizacao, nunca requisito — falhar aqui nao pode quebrar o login.
  }
}

/** Devolve o perfil guardado apenas se pertencer ao usuario informado. */
export async function readCachedProfile(userId: string): Promise<CachedProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isProfileShape(parsed)) return null;
    if (parsed.id !== userId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearCachedProfile(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CACHE_KEY);
  } catch {
    // idem
  }
}
