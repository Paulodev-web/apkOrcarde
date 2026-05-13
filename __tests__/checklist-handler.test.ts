import { handleMarkChecklistItem } from '@/lib/offline/handlers/checklist.handler';
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

function makeChecklistPayload(overrides: Record<string, unknown> = {}) {
  return {
    work_id: 'work-1',
    checklist_id: 'checklist-1',
    item_id: 'item-1',
    is_completed: true,
    notes: 'Verificado em campo',
    client_event_id: 'evt-checklist-1',
    media: [],
    ...overrides,
  };
}

function makeOutboxItem(overrides: Partial<OutboxItem> = {}): OutboxItem {
  return {
    id: 2,
    client_event_id: 'evt-checklist-1',
    action_type: 'mark_checklist_item',
    payload: JSON.stringify(makeChecklistPayload()),
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
  mockCallRpc.mockResolvedValue({
    success: true,
    data: { itemId: 'item-1', isNew: true },
  });
  mockUploadMedia.mockResolvedValue({ storagePath: 'test/path.jpg', fileSize: 80_000 });
});

describe('handleMarkChecklistItem', () => {
  it('marks checklist item without media via RPC', async () => {
    const item = makeOutboxItem();
    await handleMarkChecklistItem(item);

    expect(mockCallRpc).toHaveBeenCalledTimes(1);
    expect(mockCallRpc).toHaveBeenCalledWith(
      'rpc_mark_checklist_item',
      expect.objectContaining({
        work_id: 'work-1',
        checklist_id: 'checklist-1',
        item_id: 'item-1',
        is_completed: true,
      }),
    );
    expect(mockUploadMedia).not.toHaveBeenCalled();
  });

  it('uploads photo before calling RPC when media is present', async () => {
    const payload = makeChecklistPayload({
      media: [
        {
          id: 'media-1',
          kind: 'image',
          file_name: 'foto.jpg',
          file_size_bytes: 200_000,
          mime_type: 'image/jpeg',
          storage_path: 'work-1/checklists/checklist-1/item-1/foto.jpg',
          width: 1920,
          height: 1080,
        },
      ],
    });

    const item = makeOutboxItem({
      payload: JSON.stringify(payload),
      media_paths: JSON.stringify(['file:///local/foto.jpg']),
    });

    await handleMarkChecklistItem(item);

    expect(mockUploadMedia).toHaveBeenCalledTimes(1);
    expect(mockUploadMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        storagePath: 'work-1/checklists/checklist-1/item-1/foto.jpg',
        fileUri: 'file:///local/foto.jpg',
      }),
    );
    expect(mockCallRpc).toHaveBeenCalledTimes(1);
  });

  it('handles unmark (is_completed=false) without media', async () => {
    const payload = makeChecklistPayload({
      is_completed: false,
      notes: null,
    });

    mockCallRpc.mockResolvedValue({
      success: true,
      data: { itemId: 'item-1', isNew: true },
    });

    const item = makeOutboxItem({ payload: JSON.stringify(payload) });
    await handleMarkChecklistItem(item);

    expect(mockCallRpc).toHaveBeenCalledWith(
      'rpc_mark_checklist_item',
      expect.objectContaining({ is_completed: false }),
    );
  });

  it('treats idempotent response as success (isNew: false)', async () => {
    mockCallRpc.mockResolvedValue({
      success: true,
      data: { itemId: 'item-1', isNew: false },
    });

    const item = makeOutboxItem();
    await expect(handleMarkChecklistItem(item)).resolves.toBeUndefined();
    expect(mockCallRpc).toHaveBeenCalledTimes(1);
  });

  it('throws when RPC returns validation error', async () => {
    mockCallRpc.mockResolvedValue({
      success: false,
      error: 'Checklist nao esta em status editavel',
      code: 'P0001',
    });

    const item = makeOutboxItem();
    await expect(handleMarkChecklistItem(item)).rejects.toThrow(
      'Checklist nao esta em status editavel',
    );
  });

  it('throws when upload fails and skips RPC', async () => {
    mockUploadMedia.mockRejectedValue(new Error('Storage unavailable'));

    const payload = makeChecklistPayload({
      media: [
        {
          id: 'media-2',
          kind: 'image',
          file_name: 'obrigatoria.jpg',
          file_size_bytes: 100_000,
          mime_type: 'image/jpeg',
          storage_path: 'work-1/checklists/checklist-1/item-1/obrigatoria.jpg',
          width: 800,
          height: 600,
        },
      ],
    });

    const item = makeOutboxItem({
      payload: JSON.stringify(payload),
      media_paths: JSON.stringify(['file:///local/obrigatoria.jpg']),
    });

    await expect(handleMarkChecklistItem(item)).rejects.toThrow('Storage unavailable');
    expect(mockCallRpc).not.toHaveBeenCalled();
  });
});
