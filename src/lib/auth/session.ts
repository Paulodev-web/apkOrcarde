import NetInfo from '@react-native-community/netinfo';

import { saveCachedProfile } from '@/lib/auth/profile-cache';
import { supabase } from '@/lib/supabase/client';
import type { ActionResult, Profile, ProfileRole, SessionUser } from '@/types';

export type SignInSuccess = {
  user: SessionUser;
  role: ProfileRole;
  mustChangePassword: boolean;
};

/**
 * Motivo da falha ao carregar o perfil. O chamador precisa distinguir:
 * `offline` e recuperavel (segue com o perfil guardado), `not_found` e
 * `unknown` significam que o servidor respondeu algo errado de verdade.
 */
export type ProfileLoadFailureCode = 'offline' | 'not_found' | 'unknown';

const APK_ALLOWED_ROLES = new Set<ProfileRole>(['engineer', 'manager']);

export function hasApkAccess(role: ProfileRole): boolean {
  return APK_ALLOWED_ROLES.has(role);
}

/** Erro de transporte (sem resposta do servidor), pelo formato da mensagem. */
function looksLikeNetworkError(error: unknown): boolean {
  const message = (error as { message?: string } | null)?.message ?? '';
  const normalized = String(message).toLowerCase();
  return (
    normalized.includes('network request failed') ||
    normalized.includes('failed to fetch') ||
    normalized.includes('network error') ||
    normalized.includes('unable to resolve host') ||
    normalized.includes('econnrefused') ||
    normalized.includes('etimedout') ||
    normalized.includes('timeout') ||
    normalized.includes('load failed')
  );
}

/**
 * Decide se a falha foi por falta de rede. Confere o formato do erro e, em
 * seguida, o estado real da conexao — o NetInfo e a palavra final, porque
 * mensagem de erro varia entre Android, emulador e versao do SDK.
 */
async function isOfflineFailure(error: unknown): Promise<boolean> {
  if (looksLikeNetworkError(error)) return true;
  try {
    const state = await NetInfo.fetch();
    return !state.isConnected;
  } catch {
    return false;
  }
}

export async function signInApkUser(
  email: string,
  password: string,
): Promise<ActionResult<SignInSuccess>> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { success: false, error: mapAuthError(error.message) };
  }
  if (!data.session || !data.user) {
    return { success: false, error: 'Falha inesperada no login. Tente novamente.' };
  }

  const profileResult = await loadProfileForLoggedInUser(data.user.id);
  if (!profileResult.success) {
    await supabase.auth.signOut().catch(() => undefined);
    return { success: false, error: profileResult.error };
  }

  const profile = profileResult.data;
  if (!hasApkAccess(profile.role)) {
    await supabase.auth.signOut().catch(() => undefined);
    return {
      success: false,
      error: 'Esta conta nao tem acesso ao APK.',
    };
  }

  if (!profile.is_active) {
    await supabase.auth.signOut().catch(() => undefined);
    return {
      success: false,
      error: 'Conta desativada. Fale com seu engenheiro.',
    };
  }

  const userMetadata = (data.user.user_metadata ?? {}) as Record<string, unknown>;
  const mustChangePassword = userMetadata.must_change_password === true;

  // Guarda o perfil agora, enquanto ha rede — e o que vai sustentar as
  // proximas aberturas do app no canteiro, sem sinal.
  await saveCachedProfile(profile);

  return {
    success: true,
    data: {
      user: {
        id: data.user.id,
        email: data.user.email ?? '',
        fullName: profile.full_name,
      },
      role: profile.role,
      mustChangePassword,
    },
  };
}

/**
 * Carrega o perfil do servidor.
 *
 * Em caso de falha, `code` diz se deu para falar com o servidor. Quem chama
 * precisa dessa distincao: sem rede o app segue com o perfil guardado, mas
 * "perfil nao existe" ou "conta desativada" sao motivos legitimos para
 * encerrar a sessao.
 */
export async function loadProfileForLoggedInUser(
  userId: string,
): Promise<ActionResult<Profile>> {
  let data: unknown = null;
  let error: unknown = null;

  try {
    const response = await supabase
      .from('profiles')
      .select('id, full_name, email, phone, role, is_active')
      .eq('id', userId)
      .single();
    data = response.data;
    error = response.error;
  } catch (thrown) {
    // supabase-js normalmente devolve o erro, mas uma falha de fetch pode
    // escapar como excecao dependendo do ambiente.
    error = thrown;
  }

  if (error) {
    // PGRST116 = `.single()` sem nenhuma linha. O servidor respondeu.
    const code = (error as { code?: string } | null)?.code;
    if (code === 'PGRST116') {
      return { success: false, error: 'Perfil nao encontrado.', code: 'not_found' };
    }
    if (await isOfflineFailure(error)) {
      return { success: false, error: 'Sem conexao com o servidor.', code: 'offline' };
    }
    return { success: false, error: 'Nao foi possivel carregar o perfil.', code: 'unknown' };
  }

  if (!data) {
    return { success: false, error: 'Perfil nao encontrado.', code: 'not_found' };
  }

  return { success: true, data: data as Profile };
}

export async function clearMustChangePasswordFlag(): Promise<ActionResult> {
  const { error } = await supabase.auth.updateUser({
    data: { must_change_password: false },
  });
  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, data: undefined };
}

export async function changePassword(newPassword: string): Promise<ActionResult> {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
    data: { must_change_password: false },
  });
  if (error) {
    return { success: false, error: mapAuthError(error.message) };
  }
  return { success: true, data: undefined };
}

export function mapAuthError(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes('invalid login credentials')) return 'Email ou senha incorretos.';
  if (normalized.includes('email not confirmed')) return 'Email nao confirmado. Fale com seu engenheiro.';
  if (normalized.includes('network') || normalized.includes('fetch')) {
    return 'Sem conexao. Verifique sua internet.';
  }
  if (normalized.includes('rate limit')) return 'Muitas tentativas. Aguarde um instante.';
  if (normalized.includes('password should be')) return 'A senha precisa ter no minimo 8 caracteres.';
  return 'Nao foi possivel completar a operacao. Tente novamente.';
}
