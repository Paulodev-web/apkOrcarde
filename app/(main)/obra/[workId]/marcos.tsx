'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Flag, ChevronLeft } from 'lucide-react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { MILESTONE_LIMITS } from '@/constants/limits';
import { milestoneMediaPath } from '@/constants/paths';
import { useRealtimeChannel } from '@/hooks/useRealtimeChannel';
import { pickImage } from '@/lib/media/capture';
import {
  applyLocalOverrides,
  getLocalPendingMilestoneActions,
  getMilestoneStatusColor,
  getMilestoneStatusLabel,
} from '@/lib/milestones/local-pending';
import { enqueue } from '@/lib/offline/outbox';
import { supabase } from '@/lib/supabase/client';
import { getSignedUrls } from '@/lib/supabase/storage';
import { useConnectivityStore } from '@/stores/connectivity.store';
import { useSessionStore } from '@/stores/session.store';
import type {
  MediaAsset,
  MilestoneStatus,
  WorkMilestone,
  WorkMilestoneEvent,
  WorkMilestoneEventMedia,
} from '@/types';
import type { ReportMilestoneInput, ReportMilestoneMediaInput } from '@/types/rpc';
import { EmptyState } from '@/design-system/composed/EmptyState';
import { StatusBadge } from '@/design-system/composed/StatusBadge';
import { TimelineItem } from '@/design-system/composed/TimelineItem';
import { ProgressBar } from '@/design-system/primitives/ProgressBar';
import { Text as DSText } from '@/design-system/primitives/Text';
import { ScreenHeader } from '@/design-system/layouts/ScreenHeader';
import { colors, type ColorKey } from '@/design-system/tokens/colors';
import { spacing } from '@/design-system/tokens/spacing';
import { uuidV4 } from '@/utils/uuid';

const MILESTONES_KEY = 'milestones';
const MILESTONE_EVENTS_KEY = 'milestoneEvents';

async function fetchMilestones(workId: string): Promise<WorkMilestone[]> {
  const { data, error } = await supabase
    .from('work_milestones')
    .select('*')
    .eq('work_id', workId)
    .order('order_index');

  if (error) throw error;
  return (data ?? []) as WorkMilestone[];
}

async function fetchMilestoneEvents(
  milestoneId: string,
): Promise<(WorkMilestoneEvent & { work_milestone_event_media: WorkMilestoneEventMedia[] })[]> {
  const { data, error } = await supabase
    .from('work_milestone_events')
    .select('*, work_milestone_event_media(*)')
    .eq('milestone_id', milestoneId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as (WorkMilestoneEvent & { work_milestone_event_media: WorkMilestoneEventMedia[] })[];
}

export default function MilestonesScreen() {
  const params = useLocalSearchParams<{ workId: string }>();
  const router = useRouter();
  const workId = typeof params.workId === 'string' ? params.workId : '';
  const queryClient = useQueryClient();
  const isOnline = useConnectivityStore((s) => s.isOnline);

  const [localOverrides, setLocalOverrides] = useState<Map<string, MilestoneStatus>>(new Map());
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMilestone, setSelectedMilestone] = useState<WorkMilestone | null>(null);

  const query = useQuery({
    queryKey: [MILESTONES_KEY, workId],
    queryFn: () => fetchMilestones(workId),
    enabled: workId.length > 0,
  });

  const refreshLocal = useCallback(async () => {
    try {
      const overrides = await getLocalPendingMilestoneActions(workId);
      setLocalOverrides(overrides);
    } catch { /* swallow */ }
  }, [workId]);

  useEffect(() => {
    void refreshLocal();
    const interval = setInterval(() => void refreshLocal(), 3000);
    return () => clearInterval(interval);
  }, [refreshLocal]);

  useRealtimeChannel({
    channelName: `work:${workId}:events`,
    table: 'work_milestones',
    event: 'UPDATE',
    filter: `work_id=eq.${workId}`,
    onEvent: () => {
      void queryClient.invalidateQueries({ queryKey: [MILESTONES_KEY, workId] });
    },
  });

  const milestones = useMemo(
    () => applyLocalOverrides(query.data ?? [], localOverrides),
    [query.data, localOverrides],
  );

  const approvedCount = milestones.filter((m) => m.status === 'approved').length;
  const totalMilestones = milestones.length;
  const progressValue = totalMilestones > 0 ? approvedCount / totalMilestones : 0;

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: [MILESTONES_KEY, workId] });
      await refreshLocal();
    } finally {
      setRefreshing(false);
    }
  }, [queryClient, workId, refreshLocal]);

  const handleMilestoneUpdated = useCallback(() => {
    void refreshLocal();
    void queryClient.invalidateQueries({ queryKey: [MILESTONES_KEY, workId] });
  }, [refreshLocal, queryClient, workId]);

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false, title: 'Marcos' }} />
      <ScreenHeader
        title="Marcos"
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

      <View style={styles.progressContainer}>
        <DSText variant="bodyBold" color="textPrimary" style={styles.progressLabel}>
          Progresso
        </DSText>
        <ProgressBar value={progressValue} variant="success" height={10} />
        <DSText variant="caption" color="textSecondary" style={styles.progressCaption}>
          {totalMilestones > 0
            ? `${approvedCount}/${totalMilestones} marcos aprovados`
            : 'Nenhum marco cadastrado'}
        </DSText>
      </View>

      {query.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : milestones.length === 0 ? (
        <EmptyState
          icon={Flag}
          title="Nenhum marco encontrado"
          description="Os marcos da obra aparecem aqui quando estiverem cadastrados."
        />
      ) : (
        <FlatList
          data={milestones}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void handleRefresh()} />
          }
          renderItem={({ item, index }) => (
            <MilestoneTimelineRow
              milestone={item}
              isLast={index === milestones.length - 1}
              onPress={() => setSelectedMilestone(item)}
            />
          )}
        />
      )}

      {selectedMilestone ? (
        <MilestoneDetailModal
          milestone={selectedMilestone}
          workId={workId}
          onClose={() => setSelectedMilestone(null)}
          onUpdated={handleMilestoneUpdated}
        />
      ) : null}
    </View>
  );
}

function milestoneIconColor(status: MilestoneStatus): ColorKey {
  switch (status) {
    case 'pending':
      return 'neutral';
    case 'in_progress':
      return 'info';
    case 'awaiting_approval':
      return 'warning';
    case 'approved':
      return 'success';
    case 'rejected':
      return 'danger';
    default:
      return 'primary';
  }
}

function MilestoneTimelineRow({
  milestone,
  isLast,
  onPress,
}: {
  milestone: WorkMilestone;
  isLast: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{ opacity: pressed ? 0.88 : 1 }]}
      accessibilityRole="button"
    >
      <TimelineItem
        icon={Flag}
        iconColor={milestoneIconColor(milestone.status)}
        title={`#${milestone.order_index} ${milestone.name}`}
        subtitle={getMilestoneStatusLabel(milestone.status)}
        timestamp={formatDateShort(milestone.updated_at)}
        isLast={isLast}
      >
        <View style={styles.timelineBadgeRow}>
          <StatusBadge kind="milestone" status={milestone.status} />
        </View>
        {milestone.status === 'rejected' && milestone.rejection_reason ? (
          <DSText variant="caption" color="danger" numberOfLines={2}>
            Motivo: {milestone.rejection_reason}
          </DSText>
        ) : null}
        {milestone.status === 'approved' && milestone.approved_at ? (
          <DSText variant="caption" color="textSecondary">
            Aprovado em {formatDateShort(milestone.approved_at)}
          </DSText>
        ) : null}
      </TimelineItem>
    </Pressable>
  );
}

function MilestoneDetailModal({
  milestone,
  workId,
  onClose,
  onUpdated,
}: {
  milestone: WorkMilestone;
  workId: string;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const queryClient = useQueryClient();
  const userId = useSessionStore((s) => s.user?.id ?? '');
  const [showReportForm, setShowReportForm] = useState(false);

  const eventsQuery = useQuery({
    queryKey: [MILESTONE_EVENTS_KEY, milestone.id],
    queryFn: () => fetchMilestoneEvents(milestone.id),
    enabled: milestone.id.length > 0,
  });

  useRealtimeChannel({
    channelName: `work:${workId}:events`,
    table: 'work_milestone_events',
    event: 'INSERT',
    filter: `milestone_id=eq.${milestone.id}`,
    onEvent: () => {
      void queryClient.invalidateQueries({ queryKey: [MILESTONE_EVENTS_KEY, milestone.id] });
    },
  });

  const isActionable = milestone.status === 'pending' || milestone.status === 'in_progress' || milestone.status === 'rejected';
  const canStart = milestone.status === 'pending';

  const handleStart = useCallback(async () => {
    const clientEventId = uuidV4();
    await enqueue({
      client_event_id: clientEventId,
      action_type: 'set_milestone_in_progress',
      payload: { milestone_id: milestone.id, work_id: workId },
    });
    onUpdated();
  }, [milestone.id, workId, onUpdated]);

  const handleReportSubmitted = useCallback(() => {
    setShowReportForm(false);
    onUpdated();
  }, [onUpdated]);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{milestone.name}</Text>
          <Pressable onPress={onClose} style={styles.closeBtn} accessibilityLabel="Fechar">
            <Text style={styles.closeBtnText}>X</Text>
          </Pressable>
        </View>

        {showReportForm ? (
          <ReportMilestoneForm
            workId={workId}
            milestoneId={milestone.id}
            onSubmit={handleReportSubmitted}
            onCancel={() => setShowReportForm(false)}
          />
        ) : (
          <ScrollView contentContainerStyle={styles.modalContent}>
            {/* Status */}
            <View style={[styles.statusBanner, { backgroundColor: getMilestoneStatusColor(milestone.status).bg }]}>
              <Text style={[styles.statusBannerText, { color: getMilestoneStatusColor(milestone.status).fg }]}>
                {getMilestoneStatusLabel(milestone.status)}
              </Text>
            </View>

            {milestone.status === 'rejected' && milestone.rejection_reason ? (
              <View style={styles.rejectionBanner}>
                <Text style={styles.rejectionBannerText}>
                  Motivo da rejeicao: {milestone.rejection_reason}
                </Text>
              </View>
            ) : null}

            {/* Action buttons */}
            {isActionable ? (
              <View style={styles.actionRow}>
                {canStart ? (
                  <Pressable
                    onPress={() => void handleStart()}
                    style={({ pressed }) => [styles.actionButton, styles.startBtn, pressed ? styles.actionBtnPressed : null]}
                  >
                    <Text style={styles.actionButtonText}>Iniciar</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => setShowReportForm(true)}
                  style={({ pressed }) => [styles.actionButton, styles.reportBtn, pressed ? styles.actionBtnPressed : null]}
                >
                  <Text style={styles.actionButtonTextWhite}>
                    {milestone.status === 'rejected' ? 'Reportar novamente' : 'Reportar concluido'}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {/* Events history */}
            <Text style={styles.sectionTitle}>Historico de eventos</Text>
            {eventsQuery.isLoading ? (
              <ActivityIndicator size="small" color="#0a3a82" />
            ) : eventsQuery.data && eventsQuery.data.length > 0 ? (
              eventsQuery.data.map((event) => (
                <MilestoneEventCard key={event.id} event={event} />
              ))
            ) : (
              <Text style={styles.emptyEvents}>Nenhum evento registrado</Text>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

function MilestoneEventCard({
  event,
}: {
  event: WorkMilestoneEvent & { work_milestone_event_media: WorkMilestoneEventMedia[] };
}) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const media = event.work_milestone_event_media ?? [];

  useEffect(() => {
    if (media.length === 0) return;
    const paths = media.map((m) => m.storage_path);
    void getSignedUrls(paths).then(setUrls).catch(() => {});
  }, [media]);

  const eventTypeLabel = (() => {
    switch (event.event_type) {
      case 'reported': return 'Reportado';
      case 'approved': return 'Aprovado';
      case 'rejected': return 'Rejeitado';
      case 'reset': return 'Resetado';
      default: return event.event_type;
    }
  })();

  const eventColor = (() => {
    switch (event.event_type) {
      case 'reported': return '#0a3a82';
      case 'approved': return '#1a6b2c';
      case 'rejected': return '#7a1f17';
      default: return '#5a6473';
    }
  })();

  return (
    <View style={styles.eventCard}>
      <View style={styles.eventHeader}>
        <Text style={[styles.eventType, { color: eventColor }]}>{eventTypeLabel}</Text>
        <Text style={styles.eventDate}>{formatDateTime(event.created_at)}</Text>
      </View>
      <Text style={styles.eventActor}>{event.actor_role === 'manager' ? 'Gerente' : 'Engenheiro'}</Text>
      {event.notes ? <Text style={styles.eventNotes}>{event.notes}</Text> : null}
      {media.length > 0 ? (
        <View style={styles.eventPhotos}>
          {media.map((m) => {
            const url = urls[m.storage_path];
            return url ? (
              <Image key={m.id} source={{ uri: url }} style={styles.eventPhoto} />
            ) : (
              <View key={m.id} style={styles.eventPhotoPlaceholder} />
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function ReportMilestoneForm({
  workId,
  milestoneId,
  onSubmit,
  onCancel,
}: {
  workId: string;
  milestoneId: string;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<MediaAsset[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const handleAddPhoto = useCallback(async (source: 'camera' | 'gallery') => {
    if (photos.length >= MILESTONE_LIMITS.MAX_PHOTOS_PER_EVENT) {
      Alert.alert('Limite atingido', `Maximo de ${MILESTONE_LIMITS.MAX_PHOTOS_PER_EVENT} fotos.`);
      return;
    }
    const asset = await pickImage(source);
    if (asset) {
      setPhotos((prev) => [...prev, asset].slice(0, MILESTONE_LIMITS.MAX_PHOTOS_PER_EVENT));
    }
  }, [photos.length]);

  const handleRemovePhoto = useCallback((index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleConfirm = useCallback(async () => {
    setSubmitting(true);
    try {
      const clientEventId = uuidV4();
      const eventId = uuidV4();

      const media: ReportMilestoneMediaInput[] = photos.map((photo) => {
        const fileUuid = uuidV4();
        const ext = photo.fileName.split('.').pop() ?? 'jpg';
        return {
          id: uuidV4(),
          kind: 'image' as const,
          file_name: `${fileUuid}.${ext}`,
          file_size_bytes: photo.fileSize,
          mime_type: photo.mimeType,
          storage_path: milestoneMediaPath(workId, milestoneId, eventId, fileUuid, ext),
          width: photo.width ?? null,
          height: photo.height ?? null,
        };
      });

      const payload: ReportMilestoneInput = {
        work_id: workId,
        milestone_id: milestoneId,
        event_id: eventId,
        notes: notes.trim() || null,
        client_event_id: clientEventId,
        media,
      };

      const mediaPaths = photos.map((p) => p.uri);
      await enqueue({
        client_event_id: clientEventId,
        action_type: 'report_milestone',
        payload,
        media_paths: mediaPaths.length > 0 ? mediaPaths : undefined,
      });

      onSubmit();
    } catch {
      Alert.alert('Erro', 'Nao foi possivel enfileirar a acao.');
    } finally {
      setSubmitting(false);
    }
  }, [notes, photos, workId, milestoneId, onSubmit]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}
    >
      <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.formTitle}>Reportar marco concluido</Text>

        <Text style={styles.fieldLabel}>Notas (opcional)</Text>
        <TextInput
          style={styles.textArea}
          multiline
          placeholder="Descreva as evidencias..."
          placeholderTextColor="#8c95a6"
          maxLength={MILESTONE_LIMITS.MAX_NOTES_LENGTH}
          value={notes}
          onChangeText={setNotes}
        />
        <Text style={styles.counterText}>{notes.length}/{MILESTONE_LIMITS.MAX_NOTES_LENGTH}</Text>

        <Text style={styles.fieldLabel}>Fotos de evidencia (max {MILESTONE_LIMITS.MAX_PHOTOS_PER_EVENT})</Text>
        <View style={styles.photosRow}>
          {photos.map((photo, i) => (
            <View key={i} style={styles.photoWrapper}>
              <Image source={{ uri: photo.uri }} style={styles.photoThumb} />
              <Pressable onPress={() => handleRemovePhoto(i)} style={styles.removePhotoBtn}>
                <Text style={styles.removePhotoBtnText}>X</Text>
              </Pressable>
            </View>
          ))}
          {photos.length < MILESTONE_LIMITS.MAX_PHOTOS_PER_EVENT ? (
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
            disabled={submitting}
            style={({ pressed }) => [styles.confirmBtn, pressed || submitting ? styles.confirmBtnPressed : null]}
          >
            <Text style={styles.confirmBtnText}>
              {submitting ? 'Enviando...' : 'Confirmar'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function formatDateShort(iso: string): string {
  const d = new Date(iso);
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
  progressContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  progressLabel: { marginBottom: spacing.xs },
  progressCaption: { marginTop: spacing.xs, textAlign: 'center' },
  timelineBadgeRow: { marginTop: spacing.xs },
  listContent: { padding: spacing.lg, paddingBottom: 48 },

  // Modal
  modalRoot: { flex: 1, backgroundColor: '#f3f6fb', paddingTop: Platform.OS === 'ios' ? 50 : 0 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#0a3a82' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#ffffff', flex: 1 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 16 },
  modalContent: { padding: 16, paddingBottom: 48 },
  statusBanner: { padding: 12, borderRadius: 10, marginBottom: 12 },
  statusBannerText: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  rejectionBanner: { backgroundColor: '#fdecea', padding: 12, borderRadius: 10, marginBottom: 12 },
  rejectionBannerText: { color: '#7a1f17', fontSize: 13, fontWeight: '500' },
  actionRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  actionButton: { flex: 1, minHeight: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  actionBtnPressed: { opacity: 0.7 },
  startBtn: { backgroundColor: '#e3effc', borderWidth: 1, borderColor: '#0a3a82' },
  reportBtn: { backgroundColor: '#0a3a82' },
  actionButtonText: { color: '#0a3a82', fontWeight: '700', fontSize: 15 },
  actionButtonTextWhite: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#5a6473', textTransform: 'uppercase', marginBottom: 10, letterSpacing: 0.5 },
  emptyEvents: { fontSize: 13, color: '#5a6473', fontStyle: 'italic' },

  // Event card
  eventCard: { backgroundColor: '#ffffff', borderRadius: 10, padding: 14, borderWidth: 1, borderColor: '#e3e8ef', marginBottom: 10 },
  eventHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  eventType: { fontSize: 14, fontWeight: '700' },
  eventDate: { fontSize: 12, color: '#5a6473' },
  eventActor: { fontSize: 12, color: '#5a6473', marginBottom: 4 },
  eventNotes: { fontSize: 13, color: '#1c1f24', lineHeight: 18, marginTop: 4 },
  eventPhotos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  eventPhoto: { width: 80, height: 80, borderRadius: 8 },
  eventPhotoPlaceholder: { width: 80, height: 80, borderRadius: 8, backgroundColor: '#e3e8ef' },

  // Form
  formContent: { padding: 16, paddingBottom: 48 },
  formTitle: { fontSize: 18, fontWeight: '700', color: '#1c1f24', marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#5a6473', marginBottom: 6, marginTop: 12 },
  textArea: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e3e8ef', borderRadius: 10, padding: 14, fontSize: 14, color: '#1c1f24', minHeight: 100, textAlignVertical: 'top' },
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
  confirmBtnPressed: { opacity: 0.7 },
  confirmBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
});
