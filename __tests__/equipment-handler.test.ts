import { handleRecordPoleEquipment } from '@/lib/offline/handlers/equipment.handler';
import * as rpcModule from '@/lib/supabase/rpc';
import * as storageModule from '@/lib/supabase/storage';
import type { OutboxItem } from '@/types';

jest.mock('@/lib/supabase/rpc', () => {
  class RpcErr extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.name = 'RpcError';
      this.code = code;
    }
  }
  return {
    callRpc: jest.fn(),
    RpcError: RpcErr,
    isNonRetryableError: jest.fn((code: string) =>
      ['P0001', 'P0403', '23514', '23503', '23505'].includes(code),
    ),
  };
});
jest.mock('@/lib/supabase/storage');
jest.mock('@/lib/offline/outbox', () => ({
  ...jest.requireActual('@/lib/offline/outbox'),
  updateStatus: jest.fn(async () => undefined),
}));

const mockCallRpc = rpcModule.callRpc as jest.Mock;
const mockUploadMedia = storageModule.uploadMedia as jest.Mock;

function makeItem(actionType: string, payload: unknown, mediaPaths?: string[]): OutboxItem {
  return {
    id: 1,
    client_event_id: 'evt-1',
    action_type: actionType,
    payload: JSON.stringify(payload),
    media_paths: mediaPaths ? JSON.stringify(mediaPaths) : null,
    status: 'pending',
    attempts: 0,
    max_attempts: 5,
    last_error: null,
    created_at: new Date().toISOString(),
    synced_at: null,
    next_retry_at: null,
  };
}

const equipmentPayload = {
  work_id: 'work-1',
  equipment_id: 'equip-1',
  installation_id: 'inst-1',
  notes: 'transformador 45 kVA',
  installed_at: '2026-08-28T10:00:00.000Z',
  client_event_id: 'evt-1',
  media: [
    {
      kind: 'image',
      storage_path: 'work-1/pole-installations/equip-1/foto.jpg',
      mime_type: 'image/jpeg',
      file_name: 'foto.jpg',
      file_size_bytes: 900,
      is_primary: true,
    },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockCallRpc.mockResolvedValue({ success: true, data: { isNew: true } });
});

describe('equipamento montado', () => {
  it('chama a RPC com a descricao livre, sem catalogo', async () => {
    await handleRecordPoleEquipment(makeItem('record_pole_equipment', equipmentPayload));

    expect(mockCallRpc).toHaveBeenCalledWith(
      'rpc_record_pole_equipment',
      expect.objectContaining({ installation_id: 'inst-1', notes: 'transformador 45 kVA' }),
    );
    const sent = mockCallRpc.mock.calls[0][1] as typeof equipmentPayload;
    expect(sent).not.toHaveProperty('items');
  });

  it('sobe a foto antes de chamar a RPC', async () => {
    mockUploadMedia.mockResolvedValue({ storagePath: 'work-1/x/foto.jpg', fileSize: 900 });

    await handleRecordPoleEquipment(
      makeItem('record_pole_equipment', equipmentPayload, ['file:///local/foto.jpg']),
    );

    expect(mockUploadMedia).toHaveBeenCalledTimes(1);
    const sent = mockCallRpc.mock.calls[0][1] as { media: { storage_path: string }[] };
    expect(sent.media[0].storage_path).toBe('work-1/x/foto.jpg');
    // Ordem canonica: se a RPC rodasse antes, o registro chegaria sem prova.
    expect(mockUploadMedia.mock.invocationCallOrder[0]).toBeLessThan(
      mockCallRpc.mock.invocationCallOrder[0],
    );
  });

  it('erro do servidor sobe como RpcError para a fila decidir o retry', async () => {
    mockCallRpc.mockResolvedValue({ success: false, error: 'Acesso negado', code: 'P0403' });

    await expect(
      handleRecordPoleEquipment(makeItem('record_pole_equipment', equipmentPayload)),
    ).rejects.toThrow('Acesso negado');
  });
});
