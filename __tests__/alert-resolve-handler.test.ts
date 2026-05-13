import { handleResolveAlert } from '@/lib/offline/handlers/alert-resolve.handler';
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
    resolution_notes: 'Poste substituido por reserva do estoque local.',
    client_event_id: 'evt-resolve-1',
    media: [],
    ...overrides,
  };
}

function makeItem(overrides: Partial<OutboxItem> = {}): OutboxItem {
  return {
    id: 2,
    client_event_id: 'evt-resolve-1',
    action_type: 'resolve_alert_in_field',
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
  mockCallRpc.mockResolvedValue({ success: true, data: { updateId: 'update-1', isNew: true } });
  mockUploadMedia.mockResolvedValue({ storagePath: 'test/path.jpg', fileSize: 50_000 });
});

describe('handleResolveAlert', () => {
  it('resolves alert without media via RPC', async () => {
    await handleResolveAlert(makeItem());

    expect(mockCallRpc).toHaveBeenCalledTimes(1);
    expect(mockCallRpc).toHaveBeenCalledWith(
      'rpc_resolve_alert_in_field',
      expect.objectContaining({
        work_id: 'work-1',
        alert_id: 'alert-1',
        resolution_notes: expect.stringContaining('Poste substituido'),
      }),
    );
    expect(mockUploadMedia).not.toHaveBeenCalled();
  });

  it('uploads photos before calling RPC', async () => {
    const payload = makePayload({
      media: [{
        id: 'media-r1',
        kind: 'image',
        file_name: 'resolucao.jpg',
        file_size_bytes: 200_000,
        mime_type: 'image/jpeg',
        storage_path: 'work-1/alerts/alert-1/media-r1.jpg',
        width: 1920,
        height: 1080,
        duration_seconds: null,
      }],
    });

    const item = makeItem({
      payload: JSON.stringify(payload),
      media_paths: JSON.stringify(['file:///local/resolucao.jpg']),
    });

    await handleResolveAlert(item);

    expect(mockUploadMedia).toHaveBeenCalledTimes(1);
    expect(mockCallRpc).toHaveBeenCalledTimes(1);
  });

  it('treats idempotent response as success', async () => {
    mockCallRpc.mockResolvedValue({ success: true, data: { updateId: 'update-1', isNew: false } });
    await expect(handleResolveAlert(makeItem())).resolves.toBeUndefined();
  });

  it('throws RpcError with code on validation error', async () => {
    mockCallRpc.mockResolvedValue({
      success: false,
      error: 'Alerta nao pode ser resolvido no status atual: closed',
      code: 'P0001',
    });

    await expect(handleResolveAlert(makeItem())).rejects.toMatchObject({
      message: 'Alerta nao pode ser resolvido no status atual: closed',
      code: 'P0001',
    });
  });
});
