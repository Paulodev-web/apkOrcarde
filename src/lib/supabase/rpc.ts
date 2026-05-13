import type { ActionResult } from '@/types';

import { supabase } from './client';

type RpcInput = Record<string, unknown>;

const NON_RETRYABLE_CODES = new Set(['P0001', 'P0403', '23514', '23503', '23505']);

export class RpcError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = 'RpcError';
    this.code = code;
  }
}

export function isNonRetryableError(code: string | undefined): boolean {
  return code !== undefined && NON_RETRYABLE_CODES.has(code);
}

export async function callRpc<T>(
  name: string,
  input: RpcInput,
): Promise<ActionResult<T>> {
  const { data, error } = await supabase.rpc(name, { input: JSON.stringify(input) });

  if (error) {
    if (error.code === '23505') {
      return { success: true, data: (data ?? {}) as T };
    }
    if (error.code === 'P0403') {
      return { success: false, error: 'Acesso negado.', code: error.code };
    }
    if (error.code === 'P0001') {
      return { success: false, error: error.message, code: error.code };
    }
    if (error.code === '23514') {
      return { success: false, error: 'Dados invalidos.', code: error.code };
    }
    if (error.code === '23503') {
      return { success: false, error: 'Referencia invalida.', code: error.code };
    }
    return { success: false, error: error.message ?? 'Erro desconhecido.', code: error.code ?? undefined };
  }

  return { success: true, data: data as T };
}
