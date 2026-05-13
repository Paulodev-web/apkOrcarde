'use client';

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ALERT_LIMITS } from '@/constants/limits';
import { alertMediaPath } from '@/constants/paths';
import { AlertSeveritySelector } from '@/components/obra/AlertSeveritySelector';
import { Button } from '@/design-system/primitives/Button';
import { StepIndicator } from '@/design-system/composed/StepIndicator';
import { captureGps, type GpsReading } from '@/lib/location/gps';
import { pickImage } from '@/lib/media/capture';
import { enqueue } from '@/lib/offline/outbox';
import { getCategoryLabel } from '@/lib/alerts/local-pending';
import type { AlertSeverity, AlertCategory, MediaAsset } from '@/types';
import type { OpenAlertInput, OpenAlertMediaInput } from '@/types/rpc';
import { uuidV4 } from '@/utils/uuid';

const CATEGORIES: AlertCategory[] = [
  'accident', 'material_shortage', 'safety', 'equipment', 'weather', 'other',
];

export default function NewAlertScreen() {
  const params = useLocalSearchParams<{ workId: string }>();
  const workId = typeof params.workId === 'string' ? params.workId : '';
  const router = useRouter();
  const queryClient = useQueryClient();

  const [severity, setSeverity] = useState<AlertSeverity | null>(null);
  const [category, setCategory] = useState<AlertCategory | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<MediaAsset[]>([]);
  const [gps, setGps] = useState<GpsReading | null>(null);
  const [gpsLoading, setGpsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const reading = await captureGps();
      if (!cancelled) {
        setGps(reading);
        setGpsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const canSubmit =
    severity !== null &&
    category !== null &&
    title.length >= ALERT_LIMITS.MIN_TITLE_LENGTH &&
    title.length <= ALERT_LIMITS.MAX_TITLE_LENGTH &&
    description.length >= ALERT_LIMITS.MIN_DESCRIPTION_LENGTH &&
    description.length <= ALERT_LIMITS.MAX_DESCRIPTION_LENGTH &&
    !submitting;

  const handleAddPhoto = useCallback(async (source: 'camera' | 'gallery') => {
    if (photos.length >= ALERT_LIMITS.MAX_PHOTOS_PER_ACTION) {
      Alert.alert('Limite atingido', `Maximo de ${ALERT_LIMITS.MAX_PHOTOS_PER_ACTION} fotos por alerta.`);
      return;
    }
    const asset = await pickImage(source);
    if (asset) {
      setPhotos((prev) => [...prev, asset]);
    }
  }, [photos.length]);

  const handleRemovePhoto = useCallback((index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || !severity || !category) return;
    setSubmitting(true);

    try {
      const alertId = uuidV4();
      const clientEventId = uuidV4();

      const mediaInputs: OpenAlertMediaInput[] = [];
      const localPaths: string[] = [];

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

      const payload: OpenAlertInput = {
        work_id: workId,
        alert_id: alertId,
        severity,
        category,
        title: title.trim(),
        description: description.trim(),
        gps_lat: gps?.latitude ?? null,
        gps_lng: gps?.longitude ?? null,
        gps_accuracy_meters: gps?.accuracy ?? null,
        client_event_id: clientEventId,
        media: mediaInputs,
      };

      await enqueue({
        client_event_id: clientEventId,
        action_type: 'open_alert',
        payload,
        media_paths: localPaths.length > 0 ? localPaths : undefined,
      });

      void queryClient.invalidateQueries({ queryKey: ['alerts', workId] });
      router.back();
    } catch {
      Alert.alert('Erro', 'Nao foi possivel registrar o alerta. Tente novamente.');
      setSubmitting(false);
    }
  }, [canSubmit, severity, category, title, description, photos, gps, workId, queryClient, router]);

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: 'Novo Alerta' }} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={100}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.stepPad}>
            <StepIndicator totalSteps={3} currentStep={step} />
          </View>

          {step === 0 ? (
            <AlertSeveritySelector
              onSelect={(s) => {
                setSeverity(s);
                setStep(1);
              }}
            />
          ) : null}

          {step >= 1 ? (
          <>
          {step === 1 ? (
            <>
              <Button variant="ghost" onPress={() => setStep(0)}>
                Voltar
              </Button>
          <Text style={styles.label}>Categoria *</Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((cat) => {
              const selected = category === cat;
              return (
                <Pressable
                  key={cat}
                  onPress={() => setCategory(cat)}
                  style={[
                    styles.categoryBtn,
                    selected ? styles.categoryBtnSelected : null,
                  ]}
                  accessibilityRole="button"
                >
                  <Text style={[styles.categoryBtnText, selected ? styles.categoryBtnTextSelected : null]}>
                    {getCategoryLabel(cat)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
              <Button
                variant="primary"
                disabled={category === null}
                onPress={() => setStep(2)}
              >
                Próximo
              </Button>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <Button variant="ghost" onPress={() => setStep(1)}>
                Voltar
              </Button>
          {/* Title */}
          <Text style={styles.label}>Titulo * ({title.length}/{ALERT_LIMITS.MAX_TITLE_LENGTH})</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Ex: Queda de poste durante instalacao"
            maxLength={ALERT_LIMITS.MAX_TITLE_LENGTH}
            accessibilityLabel="Titulo do alerta"
          />
          {title.length > 0 && title.length < ALERT_LIMITS.MIN_TITLE_LENGTH ? (
            <Text style={styles.validationText}>Minimo {ALERT_LIMITS.MIN_TITLE_LENGTH} caracteres</Text>
          ) : null}

          {/* Description */}
          <Text style={styles.label}>Descricao * ({description.length}/{ALERT_LIMITS.MAX_DESCRIPTION_LENGTH})</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Descreva o incidente com detalhes..."
            multiline
            maxLength={ALERT_LIMITS.MAX_DESCRIPTION_LENGTH}
            textAlignVertical="top"
            accessibilityLabel="Descricao do alerta"
          />
          {description.length > 0 && description.length < ALERT_LIMITS.MIN_DESCRIPTION_LENGTH ? (
            <Text style={styles.validationText}>Minimo {ALERT_LIMITS.MIN_DESCRIPTION_LENGTH} caracteres</Text>
          ) : null}

          {/* GPS */}
          <Text style={styles.label}>Localizacao GPS</Text>
          <View style={styles.gpsRow}>
            {gpsLoading ? (
              <Text style={styles.gpsText}>Obtendo GPS...</Text>
            ) : gps ? (
              <Text style={styles.gpsText}>
                ({gps.latitude.toFixed(5)}, {gps.longitude.toFixed(5)}) precisao {gps.accuracy?.toFixed(0) ?? '?'}m
              </Text>
            ) : (
              <Text style={styles.gpsText}>GPS indisponivel</Text>
            )}
          </View>

          {/* Photos */}
          <Text style={styles.label}>Fotos ({photos.length}/{ALERT_LIMITS.MAX_PHOTOS_PER_ACTION})</Text>
          <View style={styles.photoRow}>
            <Pressable
              onPress={() => void handleAddPhoto('camera')}
              style={({ pressed }) => [styles.photoBtn, pressed ? styles.photoBtnPressed : null]}
              disabled={photos.length >= ALERT_LIMITS.MAX_PHOTOS_PER_ACTION}
              accessibilityRole="button"
              accessibilityLabel="Tirar foto"
            >
              <Text style={styles.photoBtnText}>Camera</Text>
            </Pressable>
            <Pressable
              onPress={() => void handleAddPhoto('gallery')}
              style={({ pressed }) => [styles.photoBtn, pressed ? styles.photoBtnPressed : null]}
              disabled={photos.length >= ALERT_LIMITS.MAX_PHOTOS_PER_ACTION}
              accessibilityRole="button"
              accessibilityLabel="Escolher da galeria"
            >
              <Text style={styles.photoBtnText}>Galeria</Text>
            </Pressable>
          </View>
          {photos.length > 0 ? (
            <View style={styles.photoList}>
              {photos.map((p, i) => (
                <View key={`photo-${i}`} style={styles.photoItem}>
                  <Text style={styles.photoName} numberOfLines={1}>{p.fileName}</Text>
                  <Pressable
                    onPress={() => handleRemovePhoto(i)}
                    style={styles.photoRemoveBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Remover foto"
                  >
                    <Text style={styles.photoRemoveText}>X</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}

          {/* Submit */}
          <Pressable
            onPress={() => void handleSubmit()}
            disabled={!canSubmit}
            style={({ pressed }) => [
              styles.submitBtn,
              !canSubmit ? styles.submitBtnDisabled : null,
              pressed && canSubmit ? styles.submitBtnPressed : null,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Registrar alerta"
          >
            <Text style={[styles.submitBtnText, !canSubmit ? styles.submitBtnTextDisabled : null]}>
              {submitting ? 'Registrando...' : 'Registrar Alerta'}
            </Text>
          </Pressable>
            </>
          ) : null}
          </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f3f6fb' },
  scroll: { padding: 16, paddingBottom: 48 },
  stepPad: { marginBottom: 8 },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5a6473',
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 16,
    letterSpacing: 0.5,
  },
  severityRow: { flexDirection: 'row', gap: 8 },
  severityBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  severityBtnText: { fontSize: 13, fontWeight: '700' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e3e8ef',
    minHeight: 44,
    justifyContent: 'center',
  },
  categoryBtnSelected: {
    backgroundColor: '#0a3a82',
    borderColor: '#0a3a82',
  },
  categoryBtnText: { fontSize: 13, fontWeight: '600', color: '#1c1f24' },
  categoryBtnTextSelected: { color: '#ffffff' },
  input: {
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
  textArea: { minHeight: 120 },
  validationText: { color: '#d32f2f', fontSize: 12, marginTop: 4 },
  gpsRow: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e3e8ef',
    padding: 14,
  },
  gpsText: { color: '#5a6473', fontSize: 13 },
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
  submitBtn: {
    marginTop: 24,
    minHeight: 52,
    backgroundColor: '#d32f2f',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnPressed: { backgroundColor: '#b71c1c' },
  submitBtnDisabled: { backgroundColor: '#e3e8ef' },
  submitBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  submitBtnTextDisabled: { color: '#5a6473' },
});
