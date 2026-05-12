# 13 — Convencoes de RPC SQL

**Status:** congelado para implementacao a partir do Bloco 2.
**Fonte original:** `APK_SCOPE.md` Secao 9.

Este documento e a referencia formal para todas as 8 RPCs SQL que o APK consome via `supabase.rpc()`. Toda RPC nova **deve** seguir estas convencoes — divergencias precisam de revisao explicita.

---

## 1. Assinatura padrao

```sql
CREATE OR REPLACE FUNCTION rpc_nome_da_funcao(input JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- declaracoes
BEGIN
  -- 1. validar membership (ver secao 2)
  -- 2. validar payload com CHECK ou RAISE
  -- 3. operacao principal em transacao implicita do plpgsql
  -- 4. retornar JSONB
END;
$$;

REVOKE EXECUTE ON FUNCTION rpc_nome_da_funcao(JSONB) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION rpc_nome_da_funcao(JSONB) TO authenticated;
```

### Por que `SECURITY DEFINER`

A RPC opera com permissao do owner (geralmente `postgres`), o que permite escrever em tabelas que tem RLS estrita sem precisar reproduzir as policies dentro da funcao. A validacao de acesso fica **dentro** da RPC (secao 2).

### Por que `SET search_path = public`

Defesa contra ataques de path hijacking via schemas extras (`pg_temp`, etc.). Sempre fixar `public`.

### Por que `REVOKE` + `GRANT`

PostgREST so aceita chamadas autenticadas. `REVOKE FROM PUBLIC, anon` impede chamadas anonimas. `GRANT TO authenticated` libera para qualquer usuario logado — a RPC ainda valida membership da obra internamente.

---

## 2. Validacao de membership

Toda RPC que opera sobre uma `work_id` deve validar membership como **primeiro passo** apos extrair o `work_id` do `input`:

```sql
DECLARE
  v_work_id UUID := (input->>'work_id')::uuid;
BEGIN
  IF v_work_id IS NULL THEN
    RAISE EXCEPTION 'work_id obrigatorio' USING errcode = 'P0001';
  END IF;

  PERFORM 1
    FROM work_members
   WHERE work_id = v_work_id
     AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acesso negado' USING errcode = 'P0403';
  END IF;

  -- ... resto da logica
END;
```

Membership e checada uma unica vez — operacoes subsequentes confiam nessa garantia.

---

## 3. Retorno de sucesso

RPC retorna **JSONB** com os campos relevantes para o cliente. Padrao:

```sql
RETURN jsonb_build_object(
  'installationId', v_new_id,
  'isNew',          v_is_new
);
```

O wrapper `callRpc<T>` no APK desempacota esse retorno em `ActionResult<T>`.

---

## 4. Idempotencia por `client_event_id`

Tabelas com idempotencia forte: `work_pole_installations`, `work_alerts` (NOT NULL UNIQUE).
Tabelas com idempotencia fraca (UNIQUE WHERE NOT NULL): `work_messages`, `work_daily_log_revisions`, `work_milestone_events`, `work_alert_updates`, `work_checklist_items`.

Padrao na RPC:

```sql
INSERT INTO work_pole_installations (id, work_id, client_event_id, ...)
VALUES (gen_random_uuid(), v_work_id, v_client_event_id, ...)
ON CONFLICT (client_event_id) DO NOTHING
RETURNING id INTO v_new_id;

IF v_new_id IS NULL THEN
  -- conflict: ja existia, retornar o registro existente
  SELECT id INTO v_new_id
    FROM work_pole_installations
   WHERE client_event_id = v_client_event_id;
  RETURN jsonb_build_object('installationId', v_new_id, 'isNew', false);
END IF;

RETURN jsonb_build_object('installationId', v_new_id, 'isNew', true);
```

O cliente envia o mesmo `client_event_id` em retries; o resultado e sempre o mesmo registro.

---

## 5. Tabela de erros

| Cenario                         | SQL                                                          | errcode  | Tratamento APK                                                                |
| ------------------------------- | ------------------------------------------------------------ | -------- | ----------------------------------------------------------------------------- |
| Validacao de payload falhou     | `RAISE EXCEPTION 'Motivo legivel' USING errcode = 'P0001'`   | `P0001`  | `{ success: false, error: 'Motivo legivel' }` exibido ao usuario              |
| Membership nao encontrada       | `RAISE EXCEPTION 'Acesso negado' USING errcode = 'P0403'`    | `P0403`  | `{ success: false, error: 'Acesso negado' }`; sem retry (rede nao resolve)    |
| Idempotencia (duplicate)        | `INSERT ... ON CONFLICT DO NOTHING` + `SELECT` existente     | —        | `{ success: true, data: existingRecord }` (transparente)                      |
| UNIQUE violation nao-idempotente| Postgres nativo                                              | `23505`  | `{ success: false, error: 'Registro duplicado' }`                             |
| CHECK constraint violado        | Postgres nativo                                              | `23514`  | `{ success: false, error: <mensagem mapeada por CHECK name> }`                |
| Foreign key violado             | Postgres nativo                                              | `23503`  | `{ success: false, error: 'Referencia invalida' }`                            |
| Rede / timeout                  | Erro de transporte do supabase-js                            | —        | Sync engine: incrementar attempts, calcular next_retry_at, requeue            |

---

## 6. Wrapper `callRpc<T>` no APK

```typescript
// src/lib/supabase/rpc.ts (a ser criado no Bloco 2)
import type { ActionResult } from '@/types';
import { supabase } from '@/lib/supabase/client';

type RpcInput = Record<string, unknown>;

export async function callRpc<T>(
  name: string,
  input: RpcInput,
): Promise<ActionResult<T>> {
  const { data, error } = await supabase.rpc(name, { input });

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
    return { success: false, error: error.message ?? 'Erro desconhecido.' };
  }

  return { success: true, data: data as T };
}
```

O sync worker (Bloco 9) usa `error.code` para decidir se retenta ou se desiste e move para `failed`.

---

## 7. Exemplo completo: `rpc_example_action`

RPC ficticia que ilustra todos os padroes. Nao implementar — apenas referencia.

### SQL

```sql
CREATE OR REPLACE FUNCTION rpc_example_action(input JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_work_id           UUID  := (input->>'work_id')::uuid;
  v_client_event_id   UUID  := (input->>'client_event_id')::uuid;
  v_payload_field     TEXT  := input->>'message';
  v_new_id            UUID;
BEGIN
  IF v_work_id IS NULL THEN
    RAISE EXCEPTION 'work_id obrigatorio' USING errcode = 'P0001';
  END IF;
  IF v_client_event_id IS NULL THEN
    RAISE EXCEPTION 'client_event_id obrigatorio' USING errcode = 'P0001';
  END IF;
  IF v_payload_field IS NULL OR length(v_payload_field) = 0 THEN
    RAISE EXCEPTION 'message obrigatorio' USING errcode = 'P0001';
  END IF;

  PERFORM 1
    FROM work_members
   WHERE work_id = v_work_id
     AND user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Acesso negado' USING errcode = 'P0403';
  END IF;

  INSERT INTO example_table (id, work_id, client_event_id, message, created_by)
  VALUES (gen_random_uuid(), v_work_id, v_client_event_id, v_payload_field, auth.uid())
  ON CONFLICT (client_event_id) DO NOTHING
  RETURNING id INTO v_new_id;

  IF v_new_id IS NULL THEN
    SELECT id INTO v_new_id
      FROM example_table
     WHERE client_event_id = v_client_event_id;
    RETURN jsonb_build_object('exampleId', v_new_id, 'isNew', false);
  END IF;

  RETURN jsonb_build_object('exampleId', v_new_id, 'isNew', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION rpc_example_action(JSONB) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION rpc_example_action(JSONB) TO authenticated;
```

### Chamada do APK

```typescript
import { callRpc } from '@/lib/supabase/rpc';
import { uuidV4 } from '@/utils/uuid';

const result = await callRpc<{ exampleId: string; isNew: boolean }>('rpc_example_action', {
  work_id: workId,
  client_event_id: uuidV4(),
  message: 'Hello world',
});

if (!result.success) {
  // exibir result.error ao usuario
  return;
}

// result.data.exampleId, result.data.isNew
```

---

## 8. Checklist para criar uma nova RPC

- [ ] Nome no formato `rpc_<acao>` (sem espacos, sem camelCase)
- [ ] Assinatura `(input JSONB) RETURNS JSONB`
- [ ] `LANGUAGE plpgsql SECURITY DEFINER SET search_path = public`
- [ ] Validacao de membership como primeiro passo
- [ ] Validacao explicita de campos obrigatorios do input com `P0001`
- [ ] Idempotencia via `client_event_id` quando aplicavel
- [ ] Retorno JSONB com chaves em camelCase
- [ ] `REVOKE FROM PUBLIC, anon` + `GRANT TO authenticated`
- [ ] Migration nomeada e versionada
- [ ] Atualizacao do tipo do APK em `src/types/rpc.ts` (input + output)
- [ ] Teste de contrato comparando com Server Action equivalente do web (DEBT-015)

---

## 9. Inventario das 8 RPCs do APK

Ver `APK_SCOPE.md` Secao 4.A2 para a lista completa. Resumo:

| RPC                                    | Bloco |
| -------------------------------------- | ----- |
| `rpc_send_work_message`                | 2     |
| `rpc_record_pole_installation`         | 3     |
| `rpc_publish_daily_log`                | 4     |
| `rpc_report_milestone`                 | 5     |
| `rpc_mark_checklist_item`              | 6     |
| `rpc_open_alert`                       | 7     |
| `rpc_resolve_alert_in_field`           | 7     |
| `rpc_add_alert_comment`                | 7     |

Cada RPC tera contrato proprio em `docs/apk-contracts/<numero>-<nome>.md` no bloco correspondente.
