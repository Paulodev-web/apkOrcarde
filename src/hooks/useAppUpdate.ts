import * as Updates from 'expo-updates';
import { useCallback, useState } from 'react';

/**
 * Buscar e aplicar atualizacao pelo proprio app.
 *
 * Sem isto, a unica forma de o gerente receber uma correcao era o
 * comportamento automatico do expo-updates: ele checa ao abrir, baixa em
 * segundo plano e so aplica na abertura SEGUINTE. Fechar pelo gesto de apps
 * recentes muitas vezes nem mata o processo, entao nao ha cold start e a
 * atualizacao nunca entra. Na pratica era preciso guiar alguem em campo pelo
 * "Forcar parada" das configuracoes do Android, duas vezes.
 *
 * Aqui a checagem e explicita e o reload e imediato: o app reinicia ja na
 * versao nova.
 */
export type UpdateState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'downloading' }
  | { status: 'upToDate' }
  | { status: 'error'; message: string };

export interface UseAppUpdate {
  state: UpdateState;
  /** Falso no Expo Go e no dev client, onde expo-updates nao opera. */
  available: boolean;
  /** Id curto do bundle em execucao, para conferir por telefone qual versao o aparelho esta rodando. */
  currentId: string | null;
  check: () => Promise<void>;
}

export function useAppUpdate(): UseAppUpdate {
  const [state, setState] = useState<UpdateState>({ status: 'idle' });

  const check = useCallback(async () => {
    if (!Updates.isEnabled) {
      setState({
        status: 'error',
        message: 'Atualização automática não disponível nesta instalação.',
      });
      return;
    }

    setState({ status: 'checking' });
    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) {
        setState({ status: 'upToDate' });
        return;
      }

      setState({ status: 'downloading' });
      await Updates.fetchUpdateAsync();
      // Reinicia com o bundle novo. Nao ha nada depois disto.
      await Updates.reloadAsync();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Não foi possível buscar atualização.';
      setState({ status: 'error', message });
    }
  }, []);

  return {
    state,
    available: Updates.isEnabled,
    currentId: Updates.updateId ? Updates.updateId.slice(0, 8) : null,
    check,
  };
}
