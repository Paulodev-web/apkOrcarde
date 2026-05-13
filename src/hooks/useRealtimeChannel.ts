import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { useEffect, useRef } from 'react';

import { captureBreadcrumb } from '@/lib/sentry';
import { supabase } from '@/lib/supabase/client';

function newSubscriptionTopicSuffix(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

type RealtimeChannelConfig = {
  channelName: string;
  table: string;
  event: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  filter?: string;
  onEvent: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;
};

export function useRealtimeChannel(config: RealtimeChannelConfig): void {
  const configRef = useRef(config);
  configRef.current = config;

  /** Supabase reuses `channel(topic)` by topic; multiple listeners need distinct topics. */
  const topicSuffixRef = useRef<string | null>(null);
  if (topicSuffixRef.current === null) {
    topicSuffixRef.current = newSubscriptionTopicSuffix();
  }

  useEffect(() => {
    const { channelName, table, event, filter } = configRef.current;
    const realtimeTopic = `${channelName}:${topicSuffixRef.current}`;

    const channel = supabase
      .channel(realtimeTopic)
      .on(
        'postgres_changes' as const,
        {
          event,
          schema: 'public',
          table,
          filter,
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          configRef.current.onEvent(payload);
        },
      )
      .subscribe((status) => {
        captureBreadcrumb('realtime', `${channelName}: ${status}`);
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [config.channelName, config.table, config.event, config.filter]);
}
