import { handleReportMilestone } from '@/lib/offline/handlers/milestone.handler';
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

function makeMilestonePayload(overrides: Record<string, unknown> = {}) {
  return {
    work_id: 'work-1',
    milestone_id: 'milestone-1',
    event_id: 'event-1',
    notes: 'Locacao concluida, marcos fincados conforme projeto',
    client_event_id: 'evt-milestone-1',
    media: [],
    ...overrides,
  };
}

function makeOutboxItem(overrides: Partial<OutboxItem> = {}): OutboxItem {
  return {
    id: 1,
    client_event_id: 'evt-milestone-1',
    action_type: 'report_milestone',
    payload: JSON.stringify(makeMilestonePayload()),
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
    data: { eventId: 'event-1', isNew: true },
  });
  mockUploadMedia.mockResolvedValue({ storagePath: 'test/path.jpg', fileSize: 100_000 });
});

describe('handleReportMilestone', () => {
  it('reports milestone without media via RPC', async () => {
    const item = makeOutboxItem();
    await handleReportMilestone(item);

    expect(mockCallRpc).toHaveBeenCalledTimes(1);
    expect(mockCallRpc).toHaveBeenCalledWith(
      'rpc_report_milestone',
      expect.objectContaining({
        work_id: 'work-1',
        milestone_id: 'milestone-1',
        notes: expect.stringContaining('Locacao'),
      }),
    );
    expect(mockUploadMedia).not.toHaveBeenCalled();
  });

  it('uploads photos before calling RPC', async () => {
    const payload = makeMilestonePayload({
      media: [
        {
          id: 'media-1',
          kind: 'image',
          file_name: 'evidencia.jpg',
          file_size_bytes: 300_000,
          mime_type: 'image/jpeg',
          storage_path: 'work-1/milestones/milestone-1/event-1/evidencia.jpg',
          width: 1920,
          height: 1080,
        },
      ],
    });

    const item = makeOutboxItem({
      payload: JSON.stringify(payload),
      media_paths: JSON.stringify(['file:///local/evidencia.jpg']),
    });

    await handleReportMilestone(item);

    expect(mockUploadMedia).toHaveBeenCalledTimes(1);
    expect(mockUploadMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        storagePath: 'work-1/milestones/milestone-1/event-1/evidencia.jpg',
        fileUri: 'file:///local/evidencia.jpg',
      }),
    );
    expect(mockCallRpc).toHaveBeenCalledTimes(1);
  });

  it('treats idempotent response as success (isNew: false)', async () => {
    mockCallRpc.mockResolvedValue({
      success: true,
      data: { eventId: 'event-1', isNew: false },
    });

    const item = makeOutboxItem();
    await expect(handleReportMilestone(item)).resolves.toBeUndefined();
    expect(mockCallRpc).toHaveBeenCalledTimes(1);
  });

  it('throws when RPC returns validation error', async () => {
    mockCallRpc.mockResolvedValue({
      success: false,
      error: 'Marco nao pode ser reportado no status atual: approved',
      code: 'P0001',
    });

    const item = makeOutboxItem();
    await expect(handleReportMilestone(item)).rejects.toThrow(
      'Marco nao pode ser reportado no status atual: approved',
    );
  });

  it('throws when upload fails', async () => {
    mockUploadMedia.mockRejectedValue(new Error('Upload failed'));

    const payload = makeMilestonePayload({
      media: [
        {
          id: 'media-2',
          kind: 'image',
          file_name: 'fail.jpg',
          file_size_bytes: 100_000,
          mime_type: 'image/jpeg',
          storage_path: 'work-1/milestones/milestone-1/event-1/fail.jpg',
          width: 800,
          height: 600,
        },
      ],
    });

    const item = makeOutboxItem({
      payload: JSON.stringify(payload),
      media_paths: JSON.stringify(['file:///local/fail.jpg']),
    });

    await expect(handleReportMilestone(item)).rejects.toThrow('Upload failed');
    expect(mockCallRpc).not.toHaveBeenCalled();
  });
});
