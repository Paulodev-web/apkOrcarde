import type { OutboxItem } from '@/types';

export type SyncHandler = (item: OutboxItem) => Promise<void>;

const handlers: Record<string, SyncHandler> = {};

export function registerHandler(actionType: string, handler: SyncHandler): void {
  handlers[actionType] = handler;
}

export function getHandler(actionType: string): SyncHandler | null {
  return handlers[actionType] ?? null;
}
