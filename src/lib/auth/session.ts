import { supabase } from '@/lib/supabase/client';
import type { ActionResult, Profile, ProfileRole, SessionUser } from '@/types';

export type SignInSuccess = {
  user: SessionUser;
  role: ProfileRole;
  mustChangePassword: boolean;
};

const APK_ALLOWED_ROLES = new Set<ProfileRole>(['engineer', 'manager']);

export function hasApkAccess(role: ProfileRole): boolean {
  return APK_ALLOWED_ROLES.has(role);
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

export async function loadProfileForLoggedInUser(
  userId: string,
): Promise<ActionResult<Profile>> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone, role, is_active')
    .eq('id', userId)
    .single();

  if (error) {
    return { success: false, error: 'Nao foi possivel carregar o perfil.' };
  }
  if (!data) {
    return { success: false, error: 'Perfil nao encontrado.' };
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
