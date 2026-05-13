import { handleSendMessage } from '@/lib/offline/handlers/chat.handler';
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

function makeOutboxItem(overrides: Partial<OutboxItem> = {}): OutboxItem {
  return {
    id: 1,
    client_event_id: 'test-evt',
    action_type: 'send_message',
    payload: JSON.stringify({
      work_id: 'work-1',
      content: 'Hello',
      client_event_id: 'test-evt',
      attachments: [],
    }),
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
  mockCallRpc.mockResolvedValue({ success: true, data: { messageId: 'msg-1', isNew: true } });
  mockUploadMedia.mockResolvedValue({ storagePath: 'test/path.jpg', fileSize: 100_000 });
});

describe('handleSendMessage', () => {
  it('sends text-only message via RPC', async () => {
    const item = makeOutboxItem();
    await handleSendMessage(item);

    expect(mockCallRpc).toHaveBeenCalledTimes(1);
    expect(mockCallRpc).toHaveBeenCalledWith('rpc_send_work_message', expect.objectContaining({
      work_id: 'work-1',
      content: 'Hello',
    }));
    expect(mockUploadMedia).not.toHaveBeenCalled();
  });

  it('uploads media before calling RPC', async () => {
    const payload = {
      work_id: 'work-1',
      content: null,
      client_event_id: 'test-media',
      attachments: [
        {
          id: 'att-1',
          file_type: 'image',
          file_name: 'photo.jpg',
          file_size_bytes: 200_000,
          mime_type: 'image/jpeg',
          storage_path: 'work-1/chat/msg-1/photo.jpg',
          width: 1920,
          height: 1080,
          duration_seconds: null,
        },
      ],
    };

    const item = makeOutboxItem({
      payload: JSON.stringify(payload),
      media_paths: JSON.stringify(['file:///local/photo.jpg']),
    });

    await handleSendMessage(item);

    expect(mockUploadMedia).toHaveBeenCalledTimes(1);
    expect(mockCallRpc).toHaveBeenCalledTimes(1);
  });

  it('throws when RPC returns error', async () => {
    mockCallRpc.mockResolvedValue({ success: false, error: 'Acesso negado.', code: 'P0403' });

    const item = makeOutboxItem();
    await expect(handleSendMessage(item)).rejects.toThrow('Acesso negado.');
  });

  it('throws when upload fails', async () => {
    mockUploadMedia.mockRejectedValue(new Error('Upload failed'));

    const payload = {
      work_id: 'work-1',
      content: null,
      client_event_id: 'test-upload-fail',
      attachments: [
        {
          id: 'att-2',
          file_type: 'image',
          file_name: 'fail.jpg',
          file_size_bytes: 100_000,
          mime_type: 'image/jpeg',
          storage_path: 'work-1/chat/msg-2/fail.jpg',
          width: 800,
          height: 600,
          duration_seconds: null,
        },
      ],
    };

    const item = makeOutboxItem({
      payload: JSON.stringify(payload),
      media_paths: JSON.stringify(['file:///local/fail.jpg']),
    });

    await expect(handleSendMessage(item)).rejects.toThrow('Upload failed');
    expect(mockCallRpc).not.toHaveBeenCalled();
  });
});
