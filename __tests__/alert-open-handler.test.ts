import { handleOpenAlert } from '@/lib/offline/handlers/alert-open.handler';
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

function makePayload(overrides: Record<string, unknown> = {}) {
  return {
    work_id: 'work-1',
    alert_id: 'alert-1',
    severity: 'high',
    category: 'accident',
    title: 'Queda de poste durante instalacao',
    description: 'Poste de concreto DT 11m caiu durante o posicionamento na rua principal.',
    gps_lat: -28.12345,
    gps_lng: -52.98765,
    gps_accuracy_meters: 8.5,
    client_event_id: 'evt-alert-1',
    media: [],
    ...overrides,
  };
}

function makeItem(overrides: Partial<OutboxItem> = {}): OutboxItem {
  return {
    id: 1,
    client_event_id: 'evt-alert-1',
    action_type: 'open_alert',
    payload: JSON.stringify(makePayload()),
    media_paths: null,
    status: 'pending',
    attempts: 0,
    max_attempts: 5,
    last_error: null,
    created_at: new Date().toISOString(),
    synced_at: null,
    next_retry_at: null,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCallRpc.mockResolvedValue({ success: true, data: { alertId: 'alert-1', isNew: true } });
  mockUploadMedia.mockResolvedValue({ storagePath: 'test/path.jpg', fileSize: 100_000 });
});

describe('handleOpenAlert', () => {
  it('opens alert without media via RPC', async () => {
    await handleOpenAlert(makeItem());

    expect(mockCallRpc).toHaveBeenCalledTimes(1);
    expect(mockCallRpc).toHaveBeenCalledWith(
      'rpc_open_alert',
      expect.objectContaining({
        work_id: 'work-1',
        severity: 'high',
        category: 'accident',
        title: expect.stringContaining('Queda'),
      }),
    );
    expect(mockUploadMedia).not.toHaveBeenCalled();
  });

  it('uploads photos before calling RPC', async () => {
    const payload = makePayload({
      media: [
        {
          id: 'media-1',
          kind: 'image',
          file_name: 'foto.jpg',
          file_size_bytes: 300_000,
          mime_type: 'image/jpeg',
          storage_path: 'work-1/alerts/alert-1/media-1.jpg',
          width: 1920,
          height: 1080,
          duration_seconds: null,
        },
      ],
    });

    const item = makeItem({
      payload: JSON.stringify(payload),
      media_paths: JSON.stringify(['file:///local/foto.jpg']),
    });

    await handleOpenAlert(item);

    expect(mockUploadMedia).toHaveBeenCalledTimes(1);
    expect(mockUploadMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        storagePath: 'work-1/alerts/alert-1/media-1.jpg',
        fileUri: 'file:///local/foto.jpg',
      }),
    );
    expect(mockCallRpc).toHaveBeenCalledTimes(1);
  });

  it('treats idempotent response as success', async () => {
    mockCallRpc.mockResolvedValue({ success: true, data: { alertId: 'alert-1', isNew: false } });
    await expect(handleOpenAlert(makeItem())).resolves.toBeUndefined();
  });

  it('throws RpcError with code on validation error', async () => {
    mockCallRpc.mockResolvedValue({
      success: false,
      error: 'title deve ter entre 5 e 200 caracteres',
      code: 'P0001',
    });

    const item = makeItem();
    await expect(handleOpenAlert(item)).rejects.toMatchObject({
      message: 'title deve ter entre 5 e 200 caracteres',
      code: 'P0001',
    });
  });

  it('throws when upload fails', async () => {
    mockUploadMedia.mockRejectedValue(new Error('Upload failed'));

    const payload = makePayload({
      media: [{
        id: 'media-2',
        kind: 'image',
        file_name: 'fail.jpg',
        file_size_bytes: 100_000,
        mime_type: 'image/jpeg',
        storage_path: 'work-1/alerts/alert-1/fail.jpg',
        width: 800,
        height: 600,
        duration_seconds: null,
      }],
    });

    const item = makeItem({
      payload: JSON.stringify(payload),
      media_paths: JSON.stringify(['file:///local/fail.jpg']),
    });

    await expect(handleOpenAlert(item)).rejects.toThrow('Upload failed');
    expect(mockCallRpc).not.toHaveBeenCalled();
  });
});
