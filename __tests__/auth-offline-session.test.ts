/**
 * A sessao precisa sobreviver ao canteiro.
 *
 * O defeito que estes testes travam: abrir o app sem sinal deslogava o
 * responsavel, porque a consulta ao perfil falhava e a falha de rede era
 * tratada igual a "conta invalida". Sem sinal ele tambem nao conseguia logar
 * de novo — ficava preso do lado de fora com os registros na fila.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

import {
  clearCachedProfile,
  readCachedProfile,
  saveCachedProfile,
} from '@/lib/auth/profile-cache';
import { loadProfileForLoggedInUser } from '@/lib/auth/session';
import { supabase } from '@/lib/supabase/client';
import type { Profile } from '@/types';

const USER_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_USER_ID = '22222222-2222-2222-2222-222222222222';

const PROFILE: Profile = {
  id: USER_ID,
  full_name: 'Carlos Tauchert',
  email: 'carlos@onengenhariaeletrica.com.br',
  phone: null,
  role: 'manager',
  is_active: true,
};

/** AsyncStorage em memoria — o mock global devolve null para tudo. */
function useInMemoryStorage(): Map<string, string> {
  const store = new Map<string, string>();
  (AsyncStorage.getItem as jest.Mock).mockImplementation(
    async (key: string) => store.get(key) ?? null,
  );
  (AsyncStorage.setItem as jest.Mock).mockImplementation(async (key: string, value: string) => {
    store.set(key, value);
  });
  (AsyncStorage.removeItem as jest.Mock).mockImplementation(async (key: string) => {
    store.delete(key);
  });
  return store;
}

/** Monta a cadeia `from().select().eq().single()` com o resultado desejado. */
function mockProfileQuery(result: { data: unknown; error: unknown }): void {
  const chain: Record<string, unknown> = {};
  chain.select = jest.fn(() => chain);
  chain.eq = jest.fn(() => chain);
  chain.single = jest.fn(async () => result);
  (supabase.from as unknown as jest.Mock).mockReturnValue(chain);
}

function setConnected(isConnected: boolean): void {
  (NetInfo.fetch as jest.Mock).mockResolvedValue({
    isConnected,
    isInternetReachable: isConnected,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  useInMemoryStorage();
  setConnected(true);
});

describe('perfil guardado no aparelho', () => {
  it('grava e le o mesmo perfil', async () => {
    await saveCachedProfile(PROFILE);
    const cached = await readCachedProfile(USER_ID);

    expect(cached).not.toBeNull();
    expect(cached?.full_name).toBe('Carlos Tauchert');
    expect(cached?.role).toBe('manager');
    expect(cached?.cachedAt).toEqual(expect.any(String));
  });

  it('nao devolve o perfil de outro usuario no mesmo aparelho', async () => {
    await saveCachedProfile(PROFILE);

    await expect(readCachedProfile(OTHER_USER_ID)).resolves.toBeNull();
  });

  it('devolve null quando o guardado esta corrompido', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('{ nao e json valido');

    await expect(readCachedProfile(USER_ID)).resolves.toBeNull();
  });

  it('limpa o perfil guardado', async () => {
    await saveCachedProfile(PROFILE);
    await clearCachedProfile();

    await expect(readCachedProfile(USER_ID)).resolves.toBeNull();
  });
});

describe('classificacao da falha ao carregar o perfil', () => {
  it('marca como offline quando o fetch falha', async () => {
    mockProfileQuery({ data: null, error: { message: 'Network request failed' } });

    const result = await loadProfileForLoggedInUser(USER_ID);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('offline');
  });

  it('marca como offline quando o aparelho esta sem conexao, mesmo com erro generico', async () => {
    setConnected(false);
    mockProfileQuery({ data: null, error: { message: 'algo inesperado' } });

    const result = await loadProfileForLoggedInUser(USER_ID);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('offline');
  });

  it('marca como not_found quando o servidor responde sem nenhuma linha', async () => {
    setConnected(true);
    mockProfileQuery({ data: null, error: { code: 'PGRST116', message: 'no rows' } });

    const result = await loadProfileForLoggedInUser(USER_ID);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('not_found');
  });

  it('nao confunde erro real do servidor com falta de rede', async () => {
    setConnected(true);
    mockProfileQuery({ data: null, error: { code: '42501', message: 'permission denied' } });

    const result = await loadProfileForLoggedInUser(USER_ID);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('unknown');
  });

  it('classifica excecao lancada pelo fetch como offline', async () => {
    const chain: Record<string, unknown> = {};
    chain.select = jest.fn(() => chain);
    chain.eq = jest.fn(() => chain);
    chain.single = jest.fn(async () => {
      throw new TypeError('Network request failed');
    });
    (supabase.from as unknown as jest.Mock).mockReturnValue(chain);

    const result = await loadProfileForLoggedInUser(USER_ID);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('offline');
  });

  it('devolve o perfil quando o servidor responde', async () => {
    mockProfileQuery({ data: PROFILE, error: null });

    const result = await loadProfileForLoggedInUser(USER_ID);

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.full_name).toBe('Carlos Tauchert');
  });
});

describe('o caminho do canteiro', () => {
  it('sem sinal, o perfil guardado sustenta a entrada no app', async () => {
    // Dia anterior, com rede: o login guardou o perfil.
    await saveCachedProfile(PROFILE);

    // Hoje, no canteiro, sem sinal.
    setConnected(false);
    mockProfileQuery({ data: null, error: { message: 'Network request failed' } });

    const result = await loadProfileForLoggedInUser(USER_ID);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe('offline');

    // O app recorre ao guardado em vez de deslogar.
    const cached = await readCachedProfile(USER_ID);
    expect(cached?.role).toBe('manager');
    expect(cached?.is_active).toBe(true);
  });

  it('conta desativada no servidor nao e mascarada pelo cache', async () => {
    await saveCachedProfile(PROFILE);
    setConnected(true);
    mockProfileQuery({ data: { ...PROFILE, is_active: false }, error: null });

    const result = await loadProfileForLoggedInUser(USER_ID);

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.is_active).toBe(false);
  });
});
