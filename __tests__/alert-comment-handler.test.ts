import { handleAddAlertComment } from '@/lib/offline/handlers/alert-comment.handler';
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
    notes: 'Equipe de apoio chegou ao local e iniciou avaliacao.',
    client_event_id: 'evt-comment-1',
    media: [],
    ...overrides,
  };
}

function makeItem(overrides: Partial<OutboxItem> = {}): OutboxItem {
  return {
    id: 3,
    client_event_id: 'evt-comment-1',
    action_type: 'add_alert_comment',
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
  mockCallRpc.mockResolvedValue({ success: true, data: { updateId: 'update-c1', isNew: true } });
  mockUploadMedia.mockResolvedValue({ storagePath: 'test/path.jpg', fileSize: 50_000 });
});

describe('handleAddAlertComment', () => {
  it('adds comment without media via RPC', async () => {
    await handleAddAlertComment(makeItem());

    expect(mockCallRpc).toHaveBeenCalledTimes(1);
    expect(mockCallRpc).toHaveBeenCalledWith(
      'rpc_add_alert_comment',
      expect.objectContaining({
        work_id: 'work-1',
        alert_id: 'alert-1',
        notes: expect.stringContaining('Equipe de apoio'),
      }),
    );
    expect(mockUploadMedia).not.toHaveBeenCalled();
  });

  it('uploads photo before calling RPC', async () => {
    const payload = makePayload({
      media: [{
        id: 'media-c1',
        kind: 'image',
        file_name: 'comentario.jpg',
        file_size_bytes: 150_000,
        mime_type: 'image/jpeg',
        storage_path: 'work-1/alerts/alert-1/media-c1.jpg',
        width: 1920,
        height: 1080,
        duration_seconds: null,
      }],
    });

    const item = makeItem({
      payload: JSON.stringify(payload),
      media_paths: JSON.stringify(['file:///local/comentario.jpg']),
    });

    await handleAddAlertComment(item);

    expect(mockUploadMedia).toHaveBeenCalledTimes(1);
    expect(mockCallRpc).toHaveBeenCalledTimes(1);
  });

  it('treats idempotent response as success', async () => {
    mockCallRpc.mockResolvedValue({ success: true, data: { updateId: 'update-c1', isNew: false } });
    await expect(handleAddAlertComment(makeItem())).resolves.toBeUndefined();
  });

  it('throws RpcError with code on closed alert', async () => {
    mockCallRpc.mockResolvedValue({
      success: false,
      error: 'Nao e possivel comentar em alerta encerrado',
      code: 'P0001',
    });

    await expect(handleAddAlertComment(makeItem())).rejects.toMatchObject({
      message: 'Nao e possivel comentar em alerta encerrado',
      code: 'P0001',
    });
  });

  it('throws when upload fails', async () => {
    mockUploadMedia.mockRejectedValue(new Error('Network error'));

    const payload = makePayload({
      media: [{
        id: 'media-c2',
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

    await expect(handleAddAlertComment(item)).rejects.toThrow('Network error');
    expect(mockCallRpc).not.toHaveBeenCalled();
  });
});
