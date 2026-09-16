'use client';

import { useGlobalSearchParams, useLocalSearchParams } from 'expo-router';
import { createContext, useContext, useMemo, type ReactNode } from 'react';

/**
 * De onde vem o workId dentro de /obra/[workId].
 *
 * Quem recebe o parametro de rota e o _layout, porque ELE e o segmento
 * [workId]. As telas dentro do <Tabs> estao um nivel abaixo, e ali
 * useLocalSearchParams nao enxerga o parametro do pai de forma confiavel:
 * numa aba que nao esta focada ele devolve {}, e o Tabs mantem as quatro
 * telas montadas ao mesmo tempo.
 *
 * O padrao antigo era cada tela fazer
 *
 *   const workId = typeof params.workId === 'string' ? params.workId : '';
 *
 * e esse fallback '' viajava calado ate o Postgres, onde morria em
 * `invalid input syntax for type uuid: ""` (22P02) no primeiro cast da RPC.
 * Era isso que impedia o gerente de mandar mensagem no chat e de reportar
 * marco: a leitura funcionava (a tela focada tinha o id) e a escrita saia
 * com o id vazio.
 *
 * Agora o id e resolvido uma vez no layout e descido por contexto. As telas
 * chamam useWorkId() e recebem sempre o mesmo valor, focadas ou nao.
 */
const WorkIdContext = createContext<string | null>(null);

export function WorkIdProvider({
  workId,
  children,
}: {
  workId: string;
  children: ReactNode;
}) {
  return <WorkIdContext.Provider value={workId}>{children}</WorkIdContext.Provider>;
}

/**
 * O workId da obra aberta. String vazia enquanto a rota ainda nao resolveu.
 * Chamador que vai ESCREVER deve usar requireWorkId() no lugar.
 */
export function useWorkId(): string {
  const fromContext = useContext(WorkIdContext);

  // Fallback para telas montadas fora do provider (deep link entrando direto
  // numa rota filha antes de o layout renderizar). useGlobalSearchParams ve o
  // parametro do segmento pai; useLocalSearchParams, nao.
  const local = useLocalSearchParams<{ workId?: string }>();
  const global = useGlobalSearchParams<{ workId?: string }>();

  return useMemo(() => {
    if (fromContext) return fromContext;
    if (typeof local.workId === 'string' && local.workId.length > 0) return local.workId;
    if (typeof global.workId === 'string' && global.workId.length > 0) return global.workId;
    return '';
  }, [fromContext, local.workId, global.workId]);
}

/**
 * Mesma coisa, mas para o caminho de escrita: estoura em vez de deixar um id
 * vazio chegar no outbox. Um payload com work_id '' nunca sincroniza, entao
 * falhar aqui e mais barato do que falhar depois no servidor.
 */
export function requireWorkId(workId: string): string {
  if (typeof workId !== 'string' || workId.length === 0) {
    throw new Error('Obra nao identificada. Volte e abra a obra de novo.');
  }
  return workId;
}
