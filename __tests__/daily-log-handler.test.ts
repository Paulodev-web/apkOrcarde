import { handlePublishDailyLog } from '@/lib/offline/handlers/daily-log.handler';
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

function makeDailyLogPayload(overrides: Record<string, unknown> = {}) {
  return {
    work_id: 'work-1',
    log_date: '2026-05-12',
    daily_log_id: 'log-1',
    revision_id: 'rev-1',
    crew_present: ['Jose Silva'],
    activities: 'Instalacao de postes na rua principal, total de 3 postes concluidos.',
    posts_installed_count: 3,
    meters_installed: { BT: 120.5, MT: 0, rede: 85 },
    materials_consumed: [
      { materialId: 'mat-1', name: 'Poste DT 11m', unit: 'un', quantity: 3 },
    ],
    incidents: null,
    rejection_reason: null,
    client_event_id: 'evt-daily-1',
    media: [],
    ...overrides,
  };
}

function makeOutboxItem(overrides: Partial<OutboxItem> = {}): OutboxItem {
  return {
    id: 1,
    client_event_id: 'evt-daily-1',
    action_type: 'publish_daily_log',
    payload: JSON.stringify(makeDailyLogPayload()),
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
    data: { dailyLogId: 'log-1', revisionId: 'rev-1', revisionNumber: 1, isNew: true },
  });
  mockUploadMedia.mockResolvedValue({ storagePath: 'test/path.jpg', fileSize: 100_000 });
});

describe('handlePublishDailyLog', () => {
  it('publishes daily log without media via RPC', async () => {
    const item = makeOutboxItem();
    await handlePublishDailyLog(item);

    expect(mockCallRpc).toHaveBeenCalledTimes(1);
    expect(mockCallRpc).toHaveBeenCalledWith(
      'rpc_publish_daily_log',
      expect.objectContaining({
        work_id: 'work-1',
        log_date: '2026-05-12',
        daily_log_id: 'log-1',
        activities: expect.stringContaining('Instalacao'),
      }),
    );
    expect(mockUploadMedia).not.toHaveBeenCalled();
  });

  it('uploads photos before calling RPC', async () => {
    const payload = makeDailyLogPayload({
      media: [
        {
          id: 'media-1',
          kind: 'image',
          file_name: 'photo.jpg',
          file_size_bytes: 245_000,
          mime_type: 'image/jpeg',
          storage_path: 'work-1/daily-logs/log-1/rev-1/photo.jpg',
          width: 1920,
          height: 1080,
          duration_seconds: null,
        },
      ],
    });

    const item = makeOutboxItem({
      payload: JSON.stringify(payload),
      media_paths: JSON.stringify(['file:///local/photo.jpg']),
    });

    await handlePublishDailyLog(item);

    expect(mockUploadMedia).toHaveBeenCalledTimes(1);
    expect(mockUploadMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        storagePath: 'work-1/daily-logs/log-1/rev-1/photo.jpg',
        fileUri: 'file:///local/photo.jpg',
      }),
    );
    expect(mockCallRpc).toHaveBeenCalledTimes(1);
  });

  it('treats 23505 duplicate as success (idempotency)', async () => {
    mockCallRpc.mockResolvedValue({
      success: true,
      data: { dailyLogId: 'log-1', revisionId: 'rev-1', revisionNumber: 1, isNew: false },
    });

    const item = makeOutboxItem();
    await expect(handlePublishDailyLog(item)).resolves.toBeUndefined();
    expect(mockCallRpc).toHaveBeenCalledTimes(1);
  });

  it('throws when RPC returns validation error', async () => {
    mockCallRpc.mockResolvedValue({
      success: false,
      error: 'activities deve ter pelo menos 10 caracteres',
      code: 'P0001',
    });

    const item = makeOutboxItem();
    await expect(handlePublishDailyLog(item)).rejects.toThrow(
      'activities deve ter pelo menos 10 caracteres',
    );
  });

  it('throws when upload fails', async () => {
    mockUploadMedia.mockRejectedValue(new Error('Upload failed'));

    const payload = makeDailyLogPayload({
      media: [
        {
          id: 'media-2',
          kind: 'image',
          file_name: 'fail.jpg',
          file_size_bytes: 100_000,
          mime_type: 'image/jpeg',
          storage_path: 'work-1/daily-logs/log-1/rev-1/fail.jpg',
          width: 800,
          height: 600,
          duration_seconds: null,
        },
      ],
    });

    const item = makeOutboxItem({
      payload: JSON.stringify(payload),
      media_paths: JSON.stringify(['file:///local/fail.jpg']),
    });

    await expect(handlePublishDailyLog(item)).rejects.toThrow('Upload failed');
    expect(mockCallRpc).not.toHaveBeenCalled();
  });
});
