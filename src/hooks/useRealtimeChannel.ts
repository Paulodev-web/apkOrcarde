import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { useEffect, useRef } from 'react';

import { captureBreadcrumb } from '@/lib/sentry';
import { supabase } from '@/lib/supabase/client';

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

  useEffect(() => {
    const { channelName, table, event, filter } = configRef.current;

    const channel = supabase
      .channel(channelName)
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
