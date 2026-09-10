import { handleRecordPoleEquipment } from '@/lib/offline/handlers/equipment.handler';
import { handleRecordNetworkSpan } from '@/lib/offline/handlers/span.handler';
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
  notes: null,
  installed_at: '2026-08-28T10:00:00.000Z',
  client_event_id: 'evt-1',
  items: [
    { material_id: null, label: 'BC10', quantity: 1, from_project: true },
    { material_id: null, label: 'ATR_BT', quantity: 1, from_project: false },
  ],
  media: [],
};

const spanPayload = {
  work_id: 'work-1',
  span_id: 'span-1',
  connection_id: 'conn-1',
  from_post_id: null,
  to_post_id: null,
  category: 'BT',
  meters: 118,
  meters_planned: 120,
  cable_type: 'Multiplexado 70mm',
  notes: null,
  gps_lat: -28.1,
  gps_lng: -52.9,
  installed_at: '2026-08-28T10:00:00.000Z',
  client_event_id: 'evt-1',
  media: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockCallRpc.mockResolvedValue({ success: true, data: { isNew: true } });
});

describe('equipamento montado', () => {
  it('chama a RPC com os itens marcados', async () => {
    await handleRecordPoleEquipment(makeItem('record_pole_equipment', equipmentPayload));

    expect(mockCallRpc).toHaveBeenCalledWith(
      'rpc_record_pole_equipment',
      expect.objectContaining({ installation_id: 'inst-1' }),
    );
    const sent = mockCallRpc.mock.calls[0][1] as typeof equipmentPayload;
    expect(sent.items).toHaveLength(2);
    // A divergencia com o projeto tem que sobreviver ate o servidor.
    expect(sent.items.find((i) => i.label === 'ATR_BT')?.from_project).toBe(false);
  });

  it('sobe a foto antes de chamar a RPC', async () => {
    mockUploadMedia.mockResolvedValue({ storagePath: 'work-1/x/foto.jpg', fileSize: 900 });
    const payload = {
      ...equipmentPayload,
      media: [
        {
          kind: 'image',
          storage_path: '',
          mime_type: 'image/jpeg',
          file_name: 'foto.jpg',
          file_size_bytes: 0,
          is_primary: true,
        },
      ],
    };

    await handleRecordPoleEquipment(
      makeItem('record_pole_equipment', payload, ['file:///local/foto.jpg']),
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

describe('trecho de rede', () => {
  it('leva a metragem lancada e a planejada, separadas', async () => {
    await handleRecordNetworkSpan(makeItem('record_network_span', spanPayload));

    const sent = mockCallRpc.mock.calls[0][1] as typeof spanPayload;
    expect(mockCallRpc).toHaveBeenCalledWith('rpc_record_network_span', expect.anything());
    expect(sent.meters).toBe(118);
    expect(sent.meters_planned).toBe(120);
    expect(sent.connection_id).toBe('conn-1');
  });

  it('erro do servidor sobe como RpcError', async () => {
    mockCallRpc.mockResolvedValue({ success: false, error: 'category invalida', code: 'P0001' });

    await expect(
      handleRecordNetworkSpan(makeItem('record_network_span', spanPayload)),
    ).rejects.toThrow('category invalida');
  });
});
