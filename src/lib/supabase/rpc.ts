import type { ActionResult } from '@/types';

import { supabase } from './client';

type RpcInput = Record<string, unknown>;

const NON_RETRYABLE_CODES = new Set(['P0001', 'P0403', '23514', '23503']);

export function isNonRetryableError(code: string | undefined): boolean {
  return code !== undefined && NON_RETRYABLE_CODES.has(code);
}

export async function callRpc<T>(
  name: string,
  input: RpcInput,
): Promise<ActionResult<T>> {
  const { data, error } = await supabase.rpc(name, { input: JSON.stringify(input) });

  if (error) {
    if (error.code === 'P0403') {
      return { success: false, error: 'Acesso negado.' };
    }
    if (error.code === 'P0001') {
      return { success: false, error: error.message };
    }
    if (error.code === '23505') {
      return { success: false, error: 'Registro duplicado.' };
    }
    if (error.code === '23514') {
      return { success: false, error: 'Dados invalidos.' };
    }
    if (error.code === '23503') {
      return { success: false, error: 'Referencia invalida.' };
    }
    return { success: false, error: error.message ?? 'Erro desconhecido.' };
  }

  return { success: true, data: data as T };
}
