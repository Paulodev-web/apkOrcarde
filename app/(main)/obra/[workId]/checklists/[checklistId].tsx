'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ChevronLeft } from 'lucide-react-native';

import { StatusBadge } from '@/design-system/composed/StatusBadge';
import { Button } from '@/design-system/primitives/Button';
import { ProgressBar } from '@/design-system/primitives/ProgressBar';
import { Text as DSText } from '@/design-system/primitives/Text';
import { ScreenHeader } from '@/design-system/layouts/ScreenHeader';
import { colors } from '@/design-system/tokens/colors';
import { spacing } from '@/design-system/tokens/spacing';
import { CHECKLIST_LIMITS } from '@/constants/limits';
import { checklistItemMediaPath } from '@/constants/paths';
import { useRealtimeChannel } from '@/hooks/useRealtimeChannel';
import {
  applyItemOverrides,
  deriveChecklistProgress,
  getLocalPendingChecklistOverrides,
} from '@/lib/checklists/local-pending';
import { pickImage } from '@/lib/media/capture';
import { enqueue } from '@/lib/offline/outbox';
import { supabase } from '@/lib/supabase/client';
import { getSignedUrls } from '@/lib/supabase/storage';
import { useConnectivityStore } from '@/stores/connectivity.store';
import type {
  ChecklistStatus,
  MediaAsset,
  WorkChecklist,
  WorkChecklistItem,
  WorkChecklistItemMedia,
} from '@/types';
import type { MarkChecklistItemInput, MarkChecklistItemMediaInput } from '@/types/rpc';
import { uuidV4 } from '@/utils/uuid';

const CHECKLISTS_KEY = 'checklists';
const CHECKLIST_DETAIL_KEY = 'checklistDetail';

type ChecklistWithItems = WorkChecklist & {
  work_checklist_items: (WorkChecklistItem & { work_checklist_item_media: WorkChecklistItemMedia[] })[];
};

async function fetchChecklistDetail(checklistId: string): Promise<ChecklistWithItems> {
  const { data, error } = await supabase
    .from('work_checklists')
    .select('*, work_checklist_items(*, work_checklist_item_media(*))')
    .eq('id', checklistId)
    .single();

  if (error) throw error;
  return data as ChecklistWithItems;
}

export default function ChecklistDetailScreen() {
  const params = useLocalSearchParams<{ workId: string; checklistId: string }>();
  const router = useRouter();
  const workId = typeof params.workId === 'string' ? params.workId : '';
  const checklistId = typeof params.checklistId === 'string' ? params.checklistId : '';
  const queryClient = useQueryClient();
  const isOnline = useConnectivityStore((s) => s.isOnline);

  const [itemOverrides, setItemOverrides] = useState<Map<string, boolean>>(new Map());
  const [markingItem, setMarkingItem] = useState<WorkChecklistItem | null>(null);

  const query = useQuery({
    queryKey: [CHECKLIST_DETAIL_KEY, checklistId],
    queryFn: () => fetchChecklistDetail(checklistId),
    enabled: checklistId.length > 0,
  });

  const refreshLocal = useCallback(async () => {
    try {
      const { itemOverrides: io } = await getLocalPendingChecklistOverrides(workId);
      setItemOverrides(io);
    } catch { /* swallow */ }
  }, [workId]);

  useEffect(() => {
    void refreshLocal();
    const interval = setInterval(() => void refreshLocal(), 3000);
    return () => clearInterval(interval);
  }, [refreshLocal]);

  useRealtimeChannel({
    channelName: `work:${workId}:events`,
    table: 'work_checklists',
    event: 'UPDATE',
    filter: `work_id=eq.${workId}`,
    onEvent: () => {
      void queryClient.invalidateQueries({ queryKey: [CHECKLIST_DETAIL_KEY, checklistId] });
      void queryClient.invalidateQueries({ queryKey: [CHECKLISTS_KEY, workId] });
    },
  });

  useRealtimeChannel({
    channelName: `work:${workId}:checklist-items`,
    table: 'work_checklist_items',
    event: 'UPDATE',
    onEvent: () => {
      void queryClient.invalidateQueries({ queryKey: [CHECKLIST_DETAIL_KEY, checklistId] });
      void queryClient.invalidateQueries({ queryKey: [CHECKLISTS_KEY, workId] });
    },
  });

  const checklist = query.data ?? null;
  const rawItems = checklist?.work_checklist_items ?? [];
  const items = useMemo(
    () => applyItemOverrides(rawItems, itemOverrides).sort((a, b) => a.order_index - b.order_index),
    [rawItems, itemOverrides],
  );
  const { done, total } = useMemo(() => deriveChecklistProgress(items), [items]);

  const isEditable = checklist?.status === 'in_progress' || checklist?.status === 'returned';
  const canStart = checklist?.status === 'pending';

  const handleStartChecklist = useCallback(async () => {
    const clientEventId = uuidV4();
    await enqueue({
      client_event_id: clientEventId,
      action_type: 'set_checklist_in_progress',
      payload: { checklist_id: checklistId, work_id: workId },
    });
    void queryClient.invalidateQueries({ queryKey: [CHECKLIST_DETAIL_KEY, checklistId] });
    void refreshLocal();
  }, [checklistId, workId, queryClient, refreshLocal]);

  const handleItemMarked = useCallback(() => {
    setMarkingItem(null);
    void refreshLocal();
    void queryClient.invalidateQueries({ queryKey: [CHECKLIST_DETAIL_KEY, checklistId] });
    void queryClient.invalidateQueries({ queryKey: [CHECKLISTS_KEY, workId] });
  }, [refreshLocal, queryClient, checklistId, workId]);

  const handleUnmarkItem = useCallback(async (item: WorkChecklistItem) => {
    if (!isEditable) return;
    const clientEventId = uuidV4();
    const payload: MarkChecklistItemInput = {
      work_id: workId,
      checklist_id: checklistId,
      item_id: item.id,
      is_completed: false,
      notes: null,
      client_event_id: clientEventId,
      media: [],
    };
    await enqueue({
      client_event_id: clientEventId,
      action_type: 'mark_checklist_item',
      payload,
    });
    void refreshLocal();
    void queryClient.invalidateQueries({ queryKey: [CHECKLIST_DETAIL_KEY, checklistId] });
  }, [workId, checklistId, isEditable, refreshLocal, queryClient]);

  if (query.isLoading) {
    return (
      <View style={styles.root}>
        <Stack.Screen options={{ headerShown: false, title: 'Checklist' }} />
        <ScreenHeader
          title="Checklist"
          leftAction={{
            icon: ChevronLeft,
            onPress: () => router.back(),
            accessibilityLabel: 'Voltar',
          }}
        />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (!checklist) {
    return (
      <View style={styles.root}>
        <Stack.Screen options={{ headerShown: false, title: 'Checklist' }} />
        <ScreenHeader
          title="Checklist"
          leftAction={{
            icon: ChevronLeft,
            onPress: () => router.back(),
            accessibilityLabel: 'Voltar',
          }}
        />
        <View style={styles.center}>
          <DSText variant="body" color="textSecondary">
            Erro ao carregar checklist
          </DSText>
        </View>
      </View>
    );
  }


  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false, title: checklist.name }} />
      <ScreenHeader
        title={checklist.name}
        leftAction={{
          icon: ChevronLeft,
          onPress: () => router.back(),
          accessibilityLabel: 'Voltar',
        }}
      />

      {!isOnline ? (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>Sem conexao — acoes serao enviadas quando voltar</Text>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.statusHeaderRow}>
          <StatusBadge kind="checklist" status={checklist.status} />
        </View>

        {checklist.status === 'returned' && checklist.return_reason ? (
          <View style={styles.returnBanner}>
            <DSText variant="body" color="danger">
              Devolvido: {checklist.return_reason}
            </DSText>
          </View>
        ) : null}

        <View style={styles.progressBlock}>
          <ProgressBar value={total > 0 ? done / total : 0} variant="primary" height={10} />
          <DSText variant="caption" color="textMuted" style={styles.progressCaption}>
            {done}/{total} itens
          </DSText>
        </View>

        {canStart ? (
          <Button variant="primary" onPress={() => void handleStartChecklist()} style={styles.startBtn}>
            Iniciar checklist
          </Button>
        ) : null}

        {checklist.due_date ? (
          <DSText variant="caption" color="textSecondary" style={styles.dueDate}>
            Prazo: {formatDate(checklist.due_date)}
          </DSText>
        ) : null}

        <DSText variant="label" color="textMuted" style={styles.sectionTitle}>
          Itens
        </DSText>
        {items.map((item) => (
          <ChecklistItemRow
            key={item.id}
            item={item}
            isEditable={isEditable}
            onMark={() => setMarkingItem(item)}
            onUnmark={() => void handleUnmarkItem(item)}
          />
        ))}
      </ScrollView>

      {markingItem ? (
        <MarkItemModal
          item={markingItem}
          workId={workId}
          checklistId={checklistId}
          onDone={handleItemMarked}
          onCancel={() => setMarkingItem(null)}
        />
      ) : null}
    </View>
  );
}

function ChecklistItemRow({
  item,
  isEditable,
  onMark,
  onUnmark,
}: {
  item: WorkChecklistItem & { work_checklist_item_media?: WorkChecklistItemMedia[] };
  isEditable: boolean;
  onMark: () => void;
  onUnmark: () => void;
}) {
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const media = item.work_checklist_item_media ?? [];

  useEffect(() => {
    if (media.length === 0) return;
    const paths = media.map((m) => m.storage_path);
    void getSignedUrls(paths).then(setMediaUrls).catch(() => {});
  }, [media]);

  const handlePress = () => {
    if (!isEditable) return;
    if (item.is_completed) {
      onUnmark();
    } else {
      onMark();
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={!isEditable}
      style={({ pressed }) => [styles.itemRow, pressed && isEditable ? styles.itemRowPressed : null]}
    >
      <View style={[styles.checkbox, item.is_completed ? styles.checkboxChecked : null]}>
        {item.is_completed ? <Text style={styles.checkmark}>✓</Text> : null}
      </View>
      <View style={styles.itemContent}>
        <Text style={[styles.itemLabel, item.is_completed ? styles.itemLabelDone : null]}>
          {item.label}
        </Text>
        {item.description ? (
          <Text style={styles.itemDescription}>{item.description}</Text>
        ) : null}
        {item.requires_photo && !item.is_completed ? (
          <View style={styles.photoRequiredBadge}>
            <Text style={styles.photoRequiredText}>Foto obrigatoria</Text>
          </View>
        ) : null}
        {item.is_completed && item.completed_at ? (
          <Text style={styles.completedInfo}>
            Concluido em {formatDateTime(item.completed_at)}
          </Text>
        ) : null}
        {item.notes ? <Text style={styles.itemNotes}>{item.notes}</Text> : null}
        {media.length > 0 ? (
          <View style={styles.itemPhotos}>
            {media.map((m) => {
              const url = mediaUrls[m.storage_path];
              return url ? (
                <Image key={m.id} source={{ uri: url }} style={styles.itemPhoto} />
              ) : (
                <View key={m.id} style={styles.itemPhotoPlaceholder} />
              );
            })}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

function MarkItemModal({
  item,
  workId,
  checklistId,
  onDone,
  onCancel,
}: {
  item: WorkChecklistItem;
  workId: string;
  checklistId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<MediaAsset[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const photoRequired = item.requires_photo;
  const canConfirm = !photoRequired || photos.length > 0;

  const handleAddPhoto = useCallback(async (source: 'camera' | 'gallery') => {
    if (photos.length >= CHECKLIST_LIMITS.MAX_PHOTOS_PER_ITEM) {
      Alert.alert('Limite atingido', `Maximo de ${CHECKLIST_LIMITS.MAX_PHOTOS_PER_ITEM} fotos.`);
      return;
    }
    const asset = await pickImage(source);
    if (asset) {
      setPhotos((prev) => [...prev, asset].slice(0, CHECKLIST_LIMITS.MAX_PHOTOS_PER_ITEM));
    }
  }, [photos.length]);

  const handleRemovePhoto = useCallback((index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!canConfirm) return;
    setSubmitting(true);
    try {
      const clientEventId = uuidV4();

      const media: MarkChecklistItemMediaInput[] = photos.map((photo) => {
        const fileUuid = uuidV4();
        const ext = photo.fileName.split('.').pop() ?? 'jpg';
        return {
          id: uuidV4(),
          kind: 'image' as const,
          file_name: `${fileUuid}.${ext}`,
          file_size_bytes: photo.fileSize,
          mime_type: photo.mimeType,
          storage_path: checklistItemMediaPath(workId, checklistId, item.id, fileUuid, ext),
          width: photo.width ?? null,
          height: photo.height ?? null,
        };
      });

      const payload: MarkChecklistItemInput = {
        work_id: workId,
        checklist_id: checklistId,
        item_id: item.id,
        is_completed: true,
        notes: notes.trim() || null,
        client_event_id: clientEventId,
        media,
      };

      const mediaPaths = photos.map((p) => p.uri);
      await enqueue({
        client_event_id: clientEventId,
        action_type: 'mark_checklist_item',
        payload,
        media_paths: mediaPaths.length > 0 ? mediaPaths : undefined,
      });

      onDone();
    } catch {
      Alert.alert('Erro', 'Nao foi possivel enfileirar a acao.');
    } finally {
      setSubmitting(false);
    }
  }, [canConfirm, notes, photos, workId, checklistId, item.id, onDone]);

  return (
    <Modal visible animationType="slide" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle} numberOfLines={2}>{item.label}</Text>
            <Pressable onPress={onCancel} style={styles.closeBtn} accessibilityLabel="Fechar">
              <Text style={styles.closeBtnText}>X</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
            {item.description ? (
              <Text style={styles.itemModalDescription}>{item.description}</Text>
            ) : null}

            <Text style={styles.fieldLabel}>Notas (opcional)</Text>
            <TextInput
              style={styles.textArea}
              multiline
              placeholder="Observacoes sobre este item..."
              placeholderTextColor="#8c95a6"
              maxLength={CHECKLIST_LIMITS.MAX_NOTES_LENGTH}
              value={notes}
              onChangeText={setNotes}
            />
            <Text style={styles.counterText}>{notes.length}/{CHECKLIST_LIMITS.MAX_NOTES_LENGTH}</Text>

            <Text style={styles.fieldLabel}>
              Foto {photoRequired ? '(obrigatoria)' : '(opcional)'} — max {CHECKLIST_LIMITS.MAX_PHOTOS_PER_ITEM}
            </Text>
            <View style={styles.photosRow}>
              {photos.map((photo, i) => (
                <View key={i} style={styles.photoWrapper}>
                  <Image source={{ uri: photo.uri }} style={styles.photoThumb} />
                  <Pressable onPress={() => handleRemovePhoto(i)} style={styles.removePhotoBtn}>
                    <Text style={styles.removePhotoBtnText}>X</Text>
                  </Pressable>
                </View>
              ))}
              {photos.length < CHECKLIST_LIMITS.MAX_PHOTOS_PER_ITEM ? (
                <View style={styles.addPhotoRow}>
                  <Pressable
                    onPress={() => void handleAddPhoto('camera')}
                    style={({ pressed }) => [styles.addPhotoBtn, pressed ? styles.addPhotoBtnPressed : null]}
                  >
                    <Text style={styles.addPhotoBtnText}>Camera</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void handleAddPhoto('gallery')}
                    style={({ pressed }) => [styles.addPhotoBtn, pressed ? styles.addPhotoBtnPressed : null]}
                  >
                    <Text style={styles.addPhotoBtnText}>Galeria</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>

            <View style={styles.formActions}>
              <Pressable
                onPress={onCancel}
                style={({ pressed }) => [styles.cancelBtn, pressed ? styles.cancelBtnPressed : null]}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={() => void handleConfirm()}
                disabled={!canConfirm || submitting}
                style={({ pressed }) => [
                  styles.confirmBtn,
                  (!canConfirm || submitting) ? styles.confirmBtnDisabled : null,
                  pressed ? styles.confirmBtnPressed : null,
                ]}
              >
                <Text style={styles.confirmBtnText}>
                  {submitting ? 'Enviando...' : 'Confirmar'}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceMuted },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  offlineBanner: { backgroundColor: colors.warningBg, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  offlineText: { color: colors.warning, fontSize: 13, textAlign: 'center' },
  errorTitle: { fontSize: 18, fontWeight: '700', color: '#1c1f24', textAlign: 'center' },
  scrollContent: { padding: spacing.lg, paddingBottom: 48 },
  statusHeaderRow: { marginBottom: spacing.md },
  progressBlock: { marginBottom: spacing.lg, gap: spacing.xs },
  progressCaption: { marginTop: 2 },
  returnBanner: { backgroundColor: colors.dangerBg, padding: spacing.sm + 2, borderRadius: 10, marginBottom: spacing.md },
  startBtn: { marginBottom: spacing.lg },
  dueDate: { marginBottom: spacing.md },
  sectionTitle: { marginBottom: spacing.sm, letterSpacing: 0.5 },

  // Item row
  itemRow: { flexDirection: 'row', backgroundColor: '#ffffff', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#e3e8ef', marginBottom: 8, alignItems: 'flex-start' },
  itemRowPressed: { opacity: 0.7 },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#c0c7d1', alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 2 },
  checkboxChecked: { backgroundColor: '#0a3a82', borderColor: '#0a3a82' },
  checkmark: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  itemContent: { flex: 1 },
  itemLabel: { fontSize: 14, fontWeight: '600', color: '#1c1f24', lineHeight: 20 },
  itemLabelDone: { textDecorationLine: 'line-through', color: '#5a6473' },
  itemDescription: { fontSize: 13, color: '#5a6473', marginTop: 4 },
  photoRequiredBadge: { marginTop: 6, alignSelf: 'flex-start', backgroundColor: '#fdf3d6', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  photoRequiredText: { fontSize: 11, fontWeight: '600', color: '#7a5b00' },
  completedInfo: { fontSize: 12, color: '#5a6473', marginTop: 4 },
  itemNotes: { fontSize: 13, color: '#1c1f24', marginTop: 4, fontStyle: 'italic' },
  itemPhotos: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  itemPhoto: { width: 60, height: 60, borderRadius: 6 },
  itemPhotoPlaceholder: { width: 60, height: 60, borderRadius: 6, backgroundColor: '#e3e8ef' },

  // Modal
  modalRoot: { flex: 1, backgroundColor: '#f3f6fb', paddingTop: Platform.OS === 'ios' ? 50 : 0 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#0a3a82' },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#ffffff', flex: 1, marginRight: 8 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 16 },
  formContent: { padding: 16, paddingBottom: 48 },
  itemModalDescription: { fontSize: 14, color: '#5a6473', marginBottom: 12, lineHeight: 20 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#5a6473', marginBottom: 6, marginTop: 12 },
  textArea: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e3e8ef', borderRadius: 10, padding: 14, fontSize: 14, color: '#1c1f24', minHeight: 80, textAlignVertical: 'top' },
  counterText: { fontSize: 12, color: '#5a6473', textAlign: 'right', marginTop: 4 },
  photosRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  photoWrapper: { position: 'relative' },
  photoThumb: { width: 80, height: 80, borderRadius: 8 },
  removePhotoBtn: { position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: '#c0392b', alignItems: 'center', justifyContent: 'center' },
  removePhotoBtnText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  addPhotoRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  addPhotoBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, backgroundColor: '#e3effc' },
  addPhotoBtnPressed: { opacity: 0.7 },
  addPhotoBtnText: { color: '#0a3a82', fontWeight: '600', fontSize: 13 },
  formActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  cancelBtn: { flex: 1, minHeight: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e3e8ef' },
  cancelBtnPressed: { opacity: 0.7 },
  cancelBtnText: { color: '#5a6473', fontWeight: '600', fontSize: 15 },
  confirmBtn: { flex: 1, minHeight: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a3a82' },
  confirmBtnDisabled: { backgroundColor: '#9cb0cc' },
  confirmBtnPressed: { opacity: 0.7 },
  confirmBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
});
