'use client';

import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { CHAT_LIMITS, SIGNED_URL_TTL_SECONDS } from '@/constants/limits';
import { chatMediaPath } from '@/constants/paths';
import { useRealtimeChannel } from '@/hooks/useRealtimeChannel';
import { pickImage, pickVideo } from '@/lib/media/capture';
import { enqueue, getPendingItemsByAction } from '@/lib/offline/outbox';
import { getSignedUrl } from '@/lib/supabase/storage';
import { supabase } from '@/lib/supabase/client';
import { useConnectivityStore } from '@/stores/connectivity.store';
import { useSessionStore } from '@/stores/session.store';
import type { MediaAsset, OutboxItem, WorkMessage } from '@/types';
import type { SendWorkMessageAttachment } from '@/types/rpc';
import { relativeTimePtBr } from '@/utils/relativeTime';
import { uuidV4 } from '@/utils/uuid';

type ChatItem =
  | { kind: 'remote'; message: WorkMessage }
  | { kind: 'local'; item: OutboxItem; payload: LocalPayload };

type LocalPayload = {
  work_id: string;
  content: string | null;
  client_event_id: string;
  attachments: SendWorkMessageAttachment[];
  sender_id: string;
  created_at: string;
};

const MESSAGES_KEY = 'messages';

async function fetchMessages(workId: string, cursor?: string) {
  let query = supabase
    .from('work_messages')
    .select('*, work_message_attachments(*)')
    .eq('work_id', workId)
    .order('created_at', { ascending: false })
    .limit(CHAT_LIMITS.MESSAGES_PER_PAGE);

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data, error } = await query;
  if (error) throw error;

  const messages = (data ?? []) as WorkMessage[];
  return {
    messages,
    nextCursor:
      messages.length === CHAT_LIMITS.MESSAGES_PER_PAGE
        ? messages[messages.length - 1].created_at
        : undefined,
  };
}

export default function ChatScreen() {
  const params = useLocalSearchParams<{ workId: string }>();
  const workId = typeof params.workId === 'string' ? params.workId : '';
  const userId = useSessionStore((s) => s.user?.id ?? '');
  const isOnline = useConnectivityStore((s) => s.isOnline);
  const queryClient = useQueryClient();

  const [inputText, setInputText] = useState('');
  const [pendingMedia, setPendingMedia] = useState<MediaAsset[]>([]);
  const [localItems, setLocalItems] = useState<OutboxItem[]>([]);
  const inputRef = useRef<TextInput>(null);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: [MESSAGES_KEY, workId],
    queryFn: ({ pageParam }) => fetchMessages(workId, pageParam),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: undefined as string | undefined,
    enabled: workId.length > 0,
  });

  const refreshLocalItems = useCallback(async () => {
    try {
      const items = await getPendingItemsByAction('send_message', workId);
      setLocalItems(items);
    } catch { /* swallow */ }
  }, [workId]);

  useEffect(() => {
    void refreshLocalItems();
    const interval = setInterval(() => void refreshLocalItems(), 2000);
    return () => clearInterval(interval);
  }, [refreshLocalItems]);

  useEffect(() => {
    void markMessagesAsRead(workId, userId);
  }, [workId, userId]);

  useRealtimeChannel({
    channelName: `work:${workId}:chat`,
    table: 'work_messages',
    event: 'INSERT',
    filter: `work_id=eq.${workId}`,
    onEvent: (payload) => {
      const msg = payload.new as WorkMessage;
      if (msg.sender_id === userId) return;
      void queryClient.invalidateQueries({ queryKey: [MESSAGES_KEY, workId] });
      void markMessagesAsRead(workId, userId);
    },
  });

  const remoteMessages = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((p) => p.messages);
  }, [data]);

  const localPendingIds = useMemo(() => {
    const ids = new Set<string>();
    for (const item of localItems) {
      try {
        const p = JSON.parse(item.payload) as LocalPayload;
        ids.add(p.client_event_id);
      } catch { /* swallow */ }
    }
    return ids;
  }, [localItems]);

  const chatItems: ChatItem[] = useMemo(() => {
    const filtered = remoteMessages
      .filter((m) => !m.client_event_id || !localPendingIds.has(m.client_event_id))
      .map((m): ChatItem => ({ kind: 'remote', message: m }));

    const locals = localItems.map((item): ChatItem => {
      const payload = JSON.parse(item.payload) as LocalPayload;
      return { kind: 'local', item, payload };
    });

    const all = [...filtered, ...locals];
    all.sort((a, b) => {
      const aTime = a.kind === 'remote' ? a.message.created_at : a.payload.created_at;
      const bTime = b.kind === 'remote' ? b.message.created_at : b.payload.created_at;
      return bTime.localeCompare(aTime);
    });

    return all;
  }, [remoteMessages, localItems, localPendingIds]);

  const handleSend = useCallback(async () => {
    const content = inputText.trim();
    const media = [...pendingMedia];

    if (!content && media.length === 0) return;

    const clientEventId = uuidV4();
    const messageId = uuidV4();
    const now = new Date().toISOString();

    const attachments: SendWorkMessageAttachment[] = media.map((m) => {
      const fileUuid = uuidV4();
      const ext = m.fileName.split('.').pop() ?? 'bin';
      return {
        id: uuidV4(),
        file_type: m.type,
        file_name: `${fileUuid}.${ext}`,
        file_size_bytes: m.fileSize,
        mime_type: m.mimeType,
        storage_path: chatMediaPath(workId, messageId, fileUuid, ext),
        width: m.width ?? null,
        height: m.height ?? null,
        duration_seconds: m.durationSeconds ?? null,
      };
    });

    const payload = {
      work_id: workId,
      content: content || null,
      client_event_id: clientEventId,
      attachments,
      sender_id: userId,
      created_at: now,
    };

    const mediaPaths = media.map((m) => m.uri);

    setInputText('');
    setPendingMedia([]);

    try {
      await enqueue({
        client_event_id: clientEventId,
        action_type: 'send_message',
        payload,
        media_paths: mediaPaths.length > 0 ? mediaPaths : undefined,
      });
      await refreshLocalItems();
    } catch { /* swallow */ }
  }, [inputText, pendingMedia, workId, userId, refreshLocalItems]);

  const handlePickImage = useCallback(async (source: 'camera' | 'gallery') => {
    if (pendingMedia.length >= CHAT_LIMITS.MAX_ATTACHMENTS_PER_MESSAGE) {
      Alert.alert('Limite atingido', `Maximo de ${CHAT_LIMITS.MAX_ATTACHMENTS_PER_MESSAGE} anexos por mensagem.`);
      return;
    }
    const asset = await pickImage(source);
    if (asset) {
      setPendingMedia((prev) => [...prev, asset].slice(0, CHAT_LIMITS.MAX_ATTACHMENTS_PER_MESSAGE));
    }
  }, [pendingMedia.length]);

  const handlePickVideo = useCallback(async (source: 'camera' | 'gallery') => {
    if (pendingMedia.length >= CHAT_LIMITS.MAX_ATTACHMENTS_PER_MESSAGE) {
      Alert.alert('Limite atingido', `Maximo de ${CHAT_LIMITS.MAX_ATTACHMENTS_PER_MESSAGE} anexos por mensagem.`);
      return;
    }
    const asset = await pickVideo(source);
    if (asset) {
      setPendingMedia((prev) => [...prev, asset].slice(0, CHAT_LIMITS.MAX_ATTACHMENTS_PER_MESSAGE));
    }
  }, [pendingMedia.length]);

  const handleRemoveMedia = useCallback((index: number) => {
    setPendingMedia((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const renderItem = useCallback(({ item }: { item: ChatItem }) => {
    if (item.kind === 'remote') {
      return <RemoteMessageBubble message={item.message} userId={userId} />;
    }
    return <LocalMessageBubble item={item.item} payload={item.payload} />;
  }, [userId]);

  const keyExtractor = useCallback((item: ChatItem) => {
    if (item.kind === 'remote') return item.message.id;
    return `local-${item.item.client_event_id}`;
  }, []);

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: 'Chat' }} />

      {!isOnline ? (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>Sem conexao — mensagens serao enviadas quando voltar</Text>
        </View>
      ) : null}

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0a3a82" />
        </View>
      ) : (
        <FlatList
          data={chatItems}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          inverted
          contentContainerStyle={styles.listContent}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
          }}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            isFetchingNextPage ? (
              <ActivityIndicator size="small" color="#0a3a82" style={styles.footerLoader} />
            ) : null
          }
        />
      )}

      {pendingMedia.length > 0 ? (
        <View style={styles.mediaPreviewRow}>
          {pendingMedia.map((m, i) => (
            <View key={i} style={styles.mediaPreviewItem}>
              {m.type === 'image' ? (
                <Image source={{ uri: m.uri }} style={styles.mediaThumb} />
              ) : (
                <View style={styles.videoThumb}>
                  <Text style={styles.videoThumbText}>Video</Text>
                </View>
              )}
              <Pressable onPress={() => handleRemoveMedia(i)} style={styles.removeMediaBtn}>
                <Text style={styles.removeMediaText}>X</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.composer}>
        <Pressable
          onPress={() => handlePickImage('camera')}
          style={styles.composerBtn}
          accessibilityLabel="Tirar foto"
        >
          <Text style={styles.composerIcon}>CAM</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            Alert.alert('Anexar midia', 'Escolha o tipo', [
              { text: 'Foto da galeria', onPress: () => void handlePickImage('gallery') },
              { text: 'Video da galeria', onPress: () => void handlePickVideo('gallery') },
              { text: 'Video da camera', onPress: () => void handlePickVideo('camera') },
              { text: 'Cancelar', style: 'cancel' },
            ]);
          }}
          style={styles.composerBtn}
          accessibilityLabel="Anexar midia"
        >
          <Text style={styles.composerIcon}>+</Text>
        </Pressable>

        <TextInput
          ref={inputRef}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Mensagem..."
          placeholderTextColor="#8c95a6"
          multiline
          maxLength={CHAT_LIMITS.MAX_CONTENT_LENGTH}
          style={styles.textInput}
        />

        <Pressable
          onPress={() => void handleSend()}
          disabled={!inputText.trim() && pendingMedia.length === 0}
          style={({ pressed }) => [
            styles.sendBtn,
            (!inputText.trim() && pendingMedia.length === 0) ? styles.sendBtnDisabled : null,
            pressed ? styles.sendBtnPressed : null,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Enviar mensagem"
        >
          <Text style={styles.sendBtnText}>Enviar</Text>
        </Pressable>
      </View>
    </View>
  );
}

function RemoteMessageBubble({ message, userId }: { message: WorkMessage; userId: string }) {
  const isMine = message.sender_id === userId;

  return (
    <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
      {!isMine ? (
        <Text style={styles.senderLabel}>Engenheiro</Text>
      ) : null}
      {message.content ? (
        <Text style={styles.messageText}>{message.content}</Text>
      ) : null}
      <AttachmentsList attachments={message.work_message_attachments} />
      <View style={styles.metaRow}>
        <Text style={styles.timeText}>{relativeTimePtBr(message.created_at)}</Text>
        {isMine ? <Text style={styles.statusIcon}>✓</Text> : null}
      </View>
    </View>
  );
}

function LocalMessageBubble({ item, payload }: { item: OutboxItem; payload: LocalPayload }) {
  const statusIcon = getStatusIcon(item.status);
  const mediaPaths: string[] = item.media_paths ? JSON.parse(item.media_paths) : [];

  return (
    <View style={[styles.bubble, styles.bubbleMine]}>
      {payload.content ? (
        <Text style={styles.messageText}>{payload.content}</Text>
      ) : null}
      {mediaPaths.map((uri, i) => (
        <Image key={i} source={{ uri }} style={styles.localMediaThumb} />
      ))}
      <View style={styles.metaRow}>
        <Text style={styles.timeText}>{relativeTimePtBr(payload.created_at)}</Text>
        <Text style={[
          styles.statusIcon,
          item.status === 'failed' ? styles.statusFailed : null,
        ]}>
          {statusIcon}
        </Text>
        {item.status === 'failed' && item.last_error ? (
          <Pressable onPress={() => Alert.alert('Erro de envio', item.last_error ?? 'Erro desconhecido')}>
            <Text style={styles.errorTapText}>Ver erro</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function AttachmentsList({ attachments }: { attachments: WorkMessage['work_message_attachments'] }) {
  if (!attachments || attachments.length === 0) return null;

  return (
    <View style={styles.attachmentsContainer}>
      {attachments.map((att) => (
        <AttachmentItem key={att.id} attachment={att} />
      ))}
    </View>
  );
}

function AttachmentItem({ attachment }: { attachment: WorkMessage['work_message_attachments'][0] }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (attachment.file_type === 'image') {
      void getSignedUrl(attachment.storage_path, SIGNED_URL_TTL_SECONDS)
        .then(setUrl)
        .catch(() => setUrl(null));
    }
  }, [attachment.storage_path, attachment.file_type]);

  if (attachment.file_type === 'image') {
    return url ? (
      <Image source={{ uri: url }} style={styles.attachmentImage} resizeMode="cover" />
    ) : (
      <View style={styles.attachmentPlaceholder}>
        <Text style={styles.attachmentPlaceholderText}>Imagem</Text>
      </View>
    );
  }

  return (
    <View style={styles.attachmentMeta}>
      <Text style={styles.attachmentMetaText}>
        {attachment.file_type === 'video' ? 'Video' : attachment.file_type === 'audio' ? 'Audio' : 'Arquivo'}
        {attachment.duration_seconds ? ` (${Math.round(attachment.duration_seconds)}s)` : ''}
      </Text>
    </View>
  );
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'pending': return '◷';
    case 'uploading_media': return '↑';
    case 'calling_rpc': return '↑';
    case 'synced': return '✓';
    case 'failed': return '✕';
    default: return '?';
  }
}

async function markMessagesAsRead(workId: string, userId: string): Promise<void> {
  if (!workId || !userId) return;
  try {
    await supabase
      .from('work_messages')
      .update({ read_by_manager_at: new Date().toISOString() })
      .eq('work_id', workId)
      .is('read_by_manager_at', null)
      .neq('sender_id', userId);
  } catch { /* silently ignore - not critical */ }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f3f6fb',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offlineBanner: {
    backgroundColor: '#fdf3d6',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  offlineText: {
    color: '#7a5b00',
    fontSize: 13,
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  footerLoader: {
    marginVertical: 16,
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 12,
    padding: 10,
    marginVertical: 3,
  },
  bubbleMine: {
    alignSelf: 'flex-end',
    backgroundColor: '#d4e6fc',
  },
  bubbleTheirs: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e3e8ef',
  },
  senderLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0a3a82',
    marginBottom: 2,
  },
  messageText: {
    fontSize: 15,
    color: '#1c1f24',
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  timeText: {
    fontSize: 11,
    color: '#5a6473',
  },
  statusIcon: {
    fontSize: 13,
    color: '#0a3a82',
  },
  statusFailed: {
    color: '#c0392b',
  },
  errorTapText: {
    fontSize: 11,
    color: '#c0392b',
    textDecorationLine: 'underline',
    marginLeft: 4,
  },
  attachmentsContainer: {
    marginTop: 6,
    gap: 4,
  },
  attachmentImage: {
    width: 200,
    height: 150,
    borderRadius: 8,
  },
  attachmentPlaceholder: {
    width: 200,
    height: 100,
    borderRadius: 8,
    backgroundColor: '#e3e8ef',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentPlaceholderText: {
    color: '#5a6473',
    fontSize: 12,
  },
  attachmentMeta: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#e3e8ef',
    borderRadius: 8,
  },
  attachmentMetaText: {
    fontSize: 13,
    color: '#3b4452',
  },
  localMediaThumb: {
    width: 120,
    height: 90,
    borderRadius: 8,
    marginTop: 4,
  },
  mediaPreviewRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e3e8ef',
    gap: 8,
  },
  mediaPreviewItem: {
    position: 'relative',
  },
  mediaThumb: {
    width: 56,
    height: 56,
    borderRadius: 6,
  },
  videoThumb: {
    width: 56,
    height: 56,
    borderRadius: 6,
    backgroundColor: '#1c1f24',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoThumbText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  removeMediaBtn: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#c0392b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeMediaText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e3e8ef',
    gap: 4,
  },
  composerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e3effc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerIcon: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0a3a82',
  },
  textInput: {
    flex: 1,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: '#e3e8ef',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 15,
    color: '#1c1f24',
    backgroundColor: '#f3f6fb',
  },
  sendBtn: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#0a3a82',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#a0b4d4',
  },
  sendBtnPressed: {
    backgroundColor: '#072a60',
  },
  sendBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
});
