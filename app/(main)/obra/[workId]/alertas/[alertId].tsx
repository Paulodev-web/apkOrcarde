'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { MessageSquare, ChevronLeft } from 'lucide-react-native';

import { TimelineItem } from '@/design-system/composed/TimelineItem';
import { SeverityBadge } from '@/design-system/composed/SeverityBadge';
import { StatusBadge } from '@/design-system/composed/StatusBadge';
import { Button } from '@/design-system/primitives/Button';
import { Card } from '@/design-system/primitives/Card';
import { Text } from '@/design-system/primitives/Text';
import { Badge } from '@/design-system/primitives/Badge';
import { ScreenHeader } from '@/design-system/layouts/ScreenHeader';
import { colors } from '@/design-system/tokens/colors';
import { spacing } from '@/design-system/tokens/spacing';
import { ALERT_LIMITS } from '@/constants/limits';
import { alertMediaPath } from '@/constants/paths';
import { useRealtimeChannel } from '@/hooks/useRealtimeChannel';
import {
  getCategoryLabel,
  getUpdateTypeLabel,
} from '@/lib/alerts/local-pending';
import { pickImage } from '@/lib/media/capture';
import { enqueue } from '@/lib/offline/outbox';
import { supabase } from '@/lib/supabase/client';
import { getSignedUrls } from '@/lib/supabase/storage';
import { useConnectivityStore } from '@/stores/connectivity.store';
import type {
  AlertStatus,
  MediaAsset,
  WorkAlert,
  WorkAlertMedia,
  WorkAlertUpdate,
} from '@/types';
import type {
  AddAlertCommentInput,
  AddAlertCommentMediaInput,
  ResolveAlertInput,
  ResolveAlertMediaInput,
} from '@/types/rpc';
import { relativeTimePtBr } from '@/utils/relativeTime';
import { uuidV4 } from '@/utils/uuid';

const ALERT_KEY = 'alert';
const ALERT_UPDATES_KEY = 'alertUpdates';
const ALERT_MEDIA_KEY = 'alertMedia';

async function fetchAlert(alertId: string): Promise<WorkAlert> {
  const { data, error } = await supabase
    .from('work_alerts')
    .select('*')
    .eq('id', alertId)
    .single();
  if (error) throw error;
  return data as WorkAlert;
}

async function fetchUpdates(alertId: string): Promise<WorkAlertUpdate[]> {
  const { data, error } = await supabase
    .from('work_alert_updates')
    .select('*')
    .eq('alert_id', alertId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as WorkAlertUpdate[];
}

async function fetchMedia(alertId: string): Promise<WorkAlertMedia[]> {
  const { data, error } = await supabase
    .from('work_alert_media')
    .select('*')
    .eq('alert_id', alertId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as WorkAlertMedia[];
}

export default function AlertDetailScreen() {
  const params = useLocalSearchParams<{ workId: string; alertId: string }>();
  const router = useRouter();
  const workId = typeof params.workId === 'string' ? params.workId : '';
  const alertId = typeof params.alertId === 'string' ? params.alertId : '';
  const queryClient = useQueryClient();
  const isOnline = useConnectivityStore((s) => s.isOnline);

  const [refreshing, setRefreshing] = useState(false);
  const [actionModal, setActionModal] = useState<'resolve' | 'comment' | null>(null);

  const alertQuery = useQuery({
    queryKey: [ALERT_KEY, alertId],
    queryFn: () => fetchAlert(alertId),
    enabled: alertId.length > 0,
  });

  const updatesQuery = useQuery({
    queryKey: [ALERT_UPDATES_KEY, alertId],
    queryFn: () => fetchUpdates(alertId),
    enabled: alertId.length > 0,
  });

  const mediaQuery = useQuery({
    queryKey: [ALERT_MEDIA_KEY, alertId],
    queryFn: () => fetchMedia(alertId),
    enabled: alertId.length > 0,
  });

  useRealtimeChannel({
    channelName: `work:${workId}:alert-detail:${alertId}`,
    table: 'work_alerts',
    event: 'UPDATE',
    filter: `id=eq.${alertId}`,
    onEvent: () => {
      void queryClient.invalidateQueries({ queryKey: [ALERT_KEY, alertId] });
    },
  });

  useRealtimeChannel({
    channelName: `work:${workId}:alert-updates:${alertId}`,
    table: 'work_alert_updates',
    event: 'INSERT',
    filter: `alert_id=eq.${alertId}`,
    onEvent: () => {
      void queryClient.invalidateQueries({ queryKey: [ALERT_UPDATES_KEY, alertId] });
      void queryClient.invalidateQueries({ queryKey: [ALERT_KEY, alertId] });
      void queryClient.invalidateQueries({ queryKey: [ALERT_MEDIA_KEY, alertId] });
    },
  });

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [ALERT_KEY, alertId] }),
        queryClient.invalidateQueries({ queryKey: [ALERT_UPDATES_KEY, alertId] }),
        queryClient.invalidateQueries({ queryKey: [ALERT_MEDIA_KEY, alertId] }),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [queryClient, alertId]);

  const handleActionDone = useCallback(() => {
    setActionModal(null);
    void queryClient.invalidateQueries({ queryKey: ['alerts', workId] });
    void queryClient.invalidateQueries({ queryKey: [ALERT_KEY, alertId] });
    void queryClient.invalidateQueries({ queryKey: [ALERT_UPDATES_KEY, alertId] });
  }, [queryClient, workId, alertId]);

  const alert = alertQuery.data;
  const updates = updatesQuery.data ?? [];
  const media = mediaQuery.data ?? [];

  if (alertQuery.isLoading) {
    return (
      <View style={styles.root}>
        <Stack.Screen options={{ headerShown: false, title: 'Alerta' }} />
        <ScreenHeader
          title="Alerta"
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

  if (!alert) {
    return (
      <View style={styles.root}>
        <Stack.Screen options={{ headerShown: false, title: 'Alerta' }} />
        <ScreenHeader
          title="Alerta"
          leftAction={{
            icon: ChevronLeft,
            onPress: () => router.back(),
            accessibilityLabel: 'Voltar',
          }}
        />
        <View style={styles.center}>
          <Text variant="body" color="textSecondary">
            Alerta nao encontrado.
          </Text>
        </View>
      </View>
    );
  }

  const canResolve = alert.status === 'open' || alert.status === 'in_progress';
  const canComment = alert.status !== 'closed';

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false, title: alert.title }} />
      <ScreenHeader
        title={alert.title}
        leftAction={{
          icon: ChevronLeft,
          onPress: () => router.back(),
          accessibilityLabel: 'Voltar',
        }}
      />

      {!isOnline ? (
        <View style={styles.offlineBanner}>
          <Text variant="body" color="warning">
            Sem conexao
          </Text>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} />
        }
      >
        <AlertHeader alert={alert} />
        <AlertTimeline updates={updates} />
        <AlertGallery media={media} />

        {alert.status === 'closed' ? (
          <View style={styles.closedBanner}>
            <Text variant="body" color="textSecondary">
              Encerrado {alert.closed_at ? `em ${new Date(alert.closed_at).toLocaleDateString('pt-BR')}` : ''}.
              {alert.closure_notes ? ` Motivo: ${alert.closure_notes}` : ''}
            </Text>
          </View>
        ) : null}

        {alert.status === 'resolved_in_field' ? (
          <View style={styles.resolvedBanner}>
            <Text variant="body" color="textSecondary">
              Resolvido em campo. Aguardando encerramento pelo engenheiro.
            </Text>
          </View>
        ) : null}

        {(canResolve || canComment) ? (
          <View style={styles.actionsSection}>
            {canResolve ? (
              <Button variant="primary" onPress={() => setActionModal('resolve')}>
                Resolver em campo
              </Button>
            ) : null}
            {canComment ? (
              <Button variant="secondary" onPress={() => setActionModal('comment')}>
                Adicionar comentario
              </Button>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      {actionModal ? (
        <AlertActionModal
          type={actionModal}
          workId={workId}
          alertId={alertId}
          onClose={() => setActionModal(null)}
          onDone={handleActionDone}
        />
      ) : null}
    </View>
  );
}

function AlertHeader({ alert }: { alert: WorkAlert }) {
  const handleOpenMaps = useCallback(() => {
    if (alert.gps_lat != null && alert.gps_lng != null) {
      void Linking.openURL(`https://www.google.com/maps?q=${alert.gps_lat},${alert.gps_lng}`);
    }
  }, [alert.gps_lat, alert.gps_lng]);

  return (
    <Card style={styles.headerCard}>
      <View style={styles.headerBadges}>
        <SeverityBadge severity={alert.severity} />
        <Badge variant="info">{getCategoryLabel(alert.category)}</Badge>
        <StatusBadge kind="alert" status={alert.status} />
      </View>
      <Text variant="heading3" color="textPrimary" style={styles.headerTitle}>
        {alert.title}
      </Text>
      <Text variant="body" color="textSecondary">
        {alert.description}
      </Text>
      <Text variant="caption" color="textMuted" style={styles.headerDate}>
        {relativeTimePtBr(alert.created_at)}
      </Text>

      {alert.gps_lat != null && alert.gps_lng != null ? (
        <Pressable onPress={handleOpenMaps} accessibilityRole="link">
          <Text variant="body" color="info" style={styles.gpsLink}>
            GPS: ({alert.gps_lat.toFixed(5)}, {alert.gps_lng.toFixed(5)})
            {alert.gps_accuracy_meters != null ? ` ±${alert.gps_accuracy_meters.toFixed(0)}m` : ''}
            {' — Abrir no Maps'}
          </Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

function AlertTimeline({ updates }: { updates: WorkAlertUpdate[] }) {
  if (updates.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text variant="label" color="textMuted" style={styles.sectionTitle}>
        Historico
      </Text>
      <View style={styles.sectionBody}>
        {updates.map((u, idx) => (
          <TimelineItem
            key={u.id}
            icon={MessageSquare}
            iconColor="primary"
            title={getUpdateTypeLabel(u.update_type)}
            subtitle={u.actor_role === 'engineer' ? 'Engenheiro' : 'Gerente'}
            timestamp={relativeTimePtBr(u.created_at)}
            isLast={idx === updates.length - 1}
          >
            {u.notes ? (
              <Text variant="body" color="textSecondary">
                {u.notes}
              </Text>
            ) : null}
          </TimelineItem>
        ))}
      </View>
    </View>
  );
}

function AlertGallery({ media }: { media: WorkAlertMedia[] }) {
  const [urls, setUrls] = useState<Record<string, string>>({});

  const paths = media.filter((m) => m.kind === 'image').map((m) => m.storage_path);

  useQuery({
    queryKey: ['alertMediaUrls', ...paths],
    queryFn: async () => {
      if (paths.length === 0) return {};
      const signed = await getSignedUrls(paths);
      setUrls(signed);
      return signed;
    },
    enabled: paths.length > 0,
  });

  if (media.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text variant="label" color="textMuted" style={styles.sectionTitle}>
        Fotos ({media.filter((m) => m.kind === 'image').length})
      </Text>
      <View style={styles.galleryGrid}>
        {media
          .filter((m) => m.kind === 'image')
          .map((m) => {
            const url = urls[m.storage_path];
            return (
              <View key={m.id} style={styles.galleryItem}>
                {url ? (
                  <Image source={{ uri: url }} style={styles.galleryImage} />
                ) : (
                  <View style={styles.galleryPlaceholder}>
                    <Text variant="caption" color="textMuted">
                      Carregando...
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
      </View>
    </View>
  );
}

type AlertActionModalProps = {
  type: 'resolve' | 'comment';
  workId: string;
  alertId: string;
  onClose: () => void;
  onDone: () => void;
};

function AlertActionModal({ type, workId, alertId, onClose, onDone }: AlertActionModalProps) {
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<MediaAsset[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const isResolve = type === 'resolve';
  const title = isResolve ? 'Resolver em campo' : 'Adicionar comentario';
  const notesLabel = isResolve ? 'Notas de resolucao *' : 'Comentario *';

  const canSubmit =
    notes.length >= ALERT_LIMITS.MIN_NOTES_LENGTH &&
    notes.length <= ALERT_LIMITS.MAX_NOTES_LENGTH &&
    !submitting;

  const handleAddPhoto = useCallback(async (source: 'camera' | 'gallery') => {
    if (photos.length >= ALERT_LIMITS.MAX_PHOTOS_PER_ACTION) {
      Alert.alert('Limite atingido', `Maximo de ${ALERT_LIMITS.MAX_PHOTOS_PER_ACTION} fotos.`);
      return;
    }
    const asset = await pickImage(source);
    if (asset) {
      setPhotos((prev) => [...prev, asset]);
    }
  }, [photos.length]);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);

    try {
      const clientEventId = uuidV4();
      const localPaths: string[] = [];

      if (isResolve) {
        const mediaInputs: ResolveAlertMediaInput[] = [];
        for (const photo of photos) {
          const fileUuid = uuidV4();
          const ext = photo.fileName.split('.').pop() ?? 'jpg';
          const storagePath = alertMediaPath(workId, alertId, fileUuid, ext);
          mediaInputs.push({
            id: fileUuid,
            kind: 'image',
            file_name: photo.fileName,
            file_size_bytes: photo.fileSize,
            mime_type: photo.mimeType,
            storage_path: storagePath,
            width: photo.width ?? null,
            height: photo.height ?? null,
            duration_seconds: null,
          });
          localPaths.push(photo.uri);
        }

        const payload: ResolveAlertInput = {
          work_id: workId,
          alert_id: alertId,
          resolution_notes: notes.trim(),
          client_event_id: clientEventId,
          media: mediaInputs,
        };

        await enqueue({
          client_event_id: clientEventId,
          action_type: 'resolve_alert_in_field',
          payload,
          media_paths: localPaths.length > 0 ? localPaths : undefined,
        });
      } else {
        const mediaInputs: AddAlertCommentMediaInput[] = [];
        for (const photo of photos) {
          const fileUuid = uuidV4();
          const ext = photo.fileName.split('.').pop() ?? 'jpg';
          const storagePath = alertMediaPath(workId, alertId, fileUuid, ext);
          mediaInputs.push({
            id: fileUuid,
            kind: 'image',
            file_name: photo.fileName,
            file_size_bytes: photo.fileSize,
            mime_type: photo.mimeType,
            storage_path: storagePath,
            width: photo.width ?? null,
            height: photo.height ?? null,
            duration_seconds: null,
          });
          localPaths.push(photo.uri);
        }

        const payload: AddAlertCommentInput = {
          work_id: workId,
          alert_id: alertId,
          notes: notes.trim(),
          client_event_id: clientEventId,
          media: mediaInputs,
        };

        await enqueue({
          client_event_id: clientEventId,
          action_type: 'add_alert_comment',
          payload,
          media_paths: localPaths.length > 0 ? localPaths : undefined,
        });
      }

      onDone();
    } catch {
      Alert.alert('Erro', 'Nao foi possivel completar a acao. Tente novamente.');
      setSubmitting(false);
    }
  }, [canSubmit, isResolve, notes, photos, workId, alertId, onDone]);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{title}</Text>
          <Pressable onPress={onClose} accessibilityRole="button">
            <Text style={styles.modalCloseText}>Cancelar</Text>
          </Pressable>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={100}
        >
          <ScrollView
            contentContainerStyle={styles.modalScroll}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.modalLabel}>{notesLabel} ({notes.length}/{ALERT_LIMITS.MAX_NOTES_LENGTH})</Text>
            <TextInput
              style={[styles.modalInput, styles.modalTextArea]}
              value={notes}
              onChangeText={setNotes}
              placeholder={isResolve ? 'Descreva como o problema foi resolvido...' : 'Adicione um comentario...'}
              multiline
              maxLength={ALERT_LIMITS.MAX_NOTES_LENGTH}
              textAlignVertical="top"
              accessibilityLabel={notesLabel}
            />
            {notes.length > 0 && notes.length < ALERT_LIMITS.MIN_NOTES_LENGTH ? (
              <Text style={styles.validationText}>Minimo {ALERT_LIMITS.MIN_NOTES_LENGTH} caracteres</Text>
            ) : null}

            <Text style={styles.modalLabel}>Fotos ({photos.length}/{ALERT_LIMITS.MAX_PHOTOS_PER_ACTION})</Text>
            <View style={styles.photoRow}>
              <Pressable
                onPress={() => void handleAddPhoto('camera')}
                style={({ pressed }) => [styles.photoBtn, pressed ? styles.photoBtnPressed : null]}
                disabled={photos.length >= ALERT_LIMITS.MAX_PHOTOS_PER_ACTION}
                accessibilityRole="button"
              >
                <Text style={styles.photoBtnText}>Camera</Text>
              </Pressable>
              <Pressable
                onPress={() => void handleAddPhoto('gallery')}
                style={({ pressed }) => [styles.photoBtn, pressed ? styles.photoBtnPressed : null]}
                disabled={photos.length >= ALERT_LIMITS.MAX_PHOTOS_PER_ACTION}
                accessibilityRole="button"
              >
                <Text style={styles.photoBtnText}>Galeria</Text>
              </Pressable>
            </View>
            {photos.length > 0 ? (
              <View style={styles.photoList}>
                {photos.map((p, i) => (
                  <View key={`modal-photo-${i}`} style={styles.photoItem}>
                    <Text style={styles.photoName} numberOfLines={1}>{p.fileName}</Text>
                    <Pressable
                      onPress={() => setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
                      style={styles.photoRemoveBtn}
                      accessibilityRole="button"
                    >
                      <Text style={styles.photoRemoveText}>X</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}

            <Pressable
              onPress={() => void handleSubmit()}
              disabled={!canSubmit}
              style={({ pressed }) => [
                styles.modalSubmitBtn,
                !canSubmit ? styles.modalSubmitBtnDisabled : null,
                pressed && canSubmit ? styles.modalSubmitBtnPressed : null,
              ]}
              accessibilityRole="button"
            >
              <Text
                variant="bodyBold"
                color={!canSubmit ? 'textMuted' : 'textInverse'}
                style={styles.modalSubmitLabel}
              >
                {submitting ? 'Enviando...' : isResolve ? 'Confirmar resolucao' : 'Enviar comentario'}
              </Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceMuted },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  offlineBanner: {
    backgroundColor: colors.warningBg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  scroll: { padding: spacing.lg, paddingBottom: 48 },
  headerCard: {
    marginBottom: spacing.lg,
  },
  headerBadges: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm, flexWrap: 'wrap' },
  headerTitle: { marginBottom: spacing.sm },
  headerDate: { marginTop: spacing.xs, marginBottom: spacing.xs },
  gpsLink: { marginTop: spacing.sm },
  section: { marginBottom: spacing.lg },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5a6473',
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingHorizontal: 4,
    letterSpacing: 0.5,
  },
  sectionBody: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e3e8ef',
  },
  timelineItem: { flexDirection: 'row', marginBottom: 16 },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0a3a82',
    marginTop: 5,
    marginRight: 12,
  },
  timelineContent: { flex: 1 },
  timelineType: { fontSize: 14, fontWeight: '700', color: '#1c1f24', marginBottom: 2 },
  timelineNotes: { fontSize: 13, color: '#3b4452', lineHeight: 18, marginBottom: 4 },
  timelineDate: { fontSize: 12, color: '#5a6473' },
  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  galleryItem: { width: 100, height: 100, borderRadius: 8, overflow: 'hidden', backgroundColor: '#e3e8ef' },
  galleryImage: { width: '100%', height: '100%' },
  galleryPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  galleryPlaceholderText: { fontSize: 10, color: '#5a6473' },
  closedBanner: {
    backgroundColor: '#dff6e1',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  closedText: { color: '#1a6b2c', fontSize: 14, fontWeight: '600' },
  resolvedBanner: {
    backgroundColor: '#e3effc',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  resolvedText: { color: '#0a3a82', fontSize: 14, fontWeight: '600' },
  actionsSection: { gap: 12, marginTop: 8 },
  actionBtn: {
    minHeight: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnPressed: { opacity: 0.7 },
  resolveBtn: { backgroundColor: '#0a3a82' },
  resolveBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  commentBtn: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#0a3a82' },
  commentBtnText: { color: '#0a3a82', fontSize: 16, fontWeight: '700' },
  // Modal styles
  modalRoot: { flex: 1, backgroundColor: '#f3f6fb' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e3e8ef',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1c1f24' },
  modalCloseText: { fontSize: 15, color: '#0a3a82', fontWeight: '600' },
  modalScroll: { padding: 16, paddingBottom: 48 },
  modalLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5a6473',
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 16,
    letterSpacing: 0.5,
  },
  modalInput: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e3e8ef',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1c1f24',
    minHeight: 48,
  },
  modalTextArea: { minHeight: 120 },
  validationText: { color: '#d32f2f', fontSize: 12, marginTop: 4 },
  photoRow: { flexDirection: 'row', gap: 12 },
  photoBtn: {
    flex: 1,
    minHeight: 48,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e3e8ef',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoBtnPressed: { backgroundColor: '#e3effc' },
  photoBtnText: { fontSize: 14, fontWeight: '600', color: '#0a3a82' },
  photoList: { marginTop: 8, gap: 6 },
  photoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e3e8ef',
  },
  photoName: { flex: 1, fontSize: 13, color: '#1c1f24' },
  photoRemoveBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  photoRemoveText: { color: '#d32f2f', fontWeight: '700', fontSize: 14 },
  modalSubmitBtn: {
    marginTop: 24,
    minHeight: 52,
    backgroundColor: '#0a3a82',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubmitBtnPressed: { backgroundColor: '#072a60' },
  modalSubmitBtnDisabled: { backgroundColor: '#e3e8ef' },
  modalSubmitLabel: { textAlign: 'center' },
});
