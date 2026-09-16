import type { ActionResult } from '@/types';

import { supabase } from './client';

type RpcInput = Record<string, unknown>;

// 22P02 entra aqui porque e erro de payload, nao de rede: e o que o Postgres
// devolve quando um campo que deveria ser UUID chega como '' ou lixo
// (`invalid input syntax for type uuid: ""`). Retentar um payload malformado
// nunca melhora — so queima bateria e rede ate esgotar max_attempts, e mantem
// o item na frente da fila FIFO atrasando o que viria depois.
const NON_RETRYABLE_CODES = new Set(['P0001', 'P0403', '22P02', '23514', '23503', '23505']);

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
  // O payload vai como OBJETO, nao como string.
  //
  // Com `JSON.stringify(input)` o PostgREST entrega ao Postgres um jsonb do
  // tipo `string` — e ai `input->>'work_id'` devolve NULL, porque nao existe
  // chave nenhuma dentro de uma string. Toda RPC entao morria em
  // "work_id e obrigatorio" ou "Cannot coerce the result to a single JSON
  // object". Era isto que impedia qualquer registro de campo de chegar ao
  // banco. Passando o objeto, o supabase-js serializa o corpo inteiro e o
  // parametro chega como jsonb `object`, que e o que as funcoes esperam.
  const { data, error } = await supabase.rpc(name, { input });

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
    if (error.code === '22P02') {
      return { success: false, error: 'Dados invalidos no envio.', code: error.code };
    }
    return { success: false, error: error.message ?? 'Erro desconhecido.', code: error.code ?? undefined };
  }

  return { success: true, data: data as T };
}
