'use client';

import { Redirect, useLocalSearchParams } from 'expo-router';

/**
 * A porta da obra leva para a planta.
 *
 * Aqui existia um painel de numeros (marco atual, alertas, diario de hoje,
 * execucao). Ele saiu porque o gerente nao abre o app para ler resumo: ele abre
 * para trabalhar, e o trabalho acontece em cima da prancha. Os numeros viraram
 * cabecalho da planta, o diario virou a aba Dia, e o impedimento aberto virou
 * faixa no topo da propria planta.
 *
 * Esta rota fica para nao quebrar deep link de notificacao nem historico de
 * navegacao apontando para /obra/{id}.
 */
export default function ObraIndexScreen() {
  const { workId } = useLocalSearchParams<{ workId: string }>();
  const id = typeof workId === 'string' ? workId : '';
  return <Redirect href={`/(main)/obra/${id}/postes` as never} />;
}
