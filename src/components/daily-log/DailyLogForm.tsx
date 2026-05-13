'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { DAILY_LOG_LIMITS } from '@/constants/limits';
import { dailyLogMediaPath } from '@/constants/paths';
import { pickImage } from '@/lib/media/capture';
import { dailyLogFormSchema, formDataToRpcPayload, type DailyLogFormData } from '@/lib/daily-log/schema';
import type { PublishDailyLogInput, PublishDailyLogMediaInput } from '@/types/rpc';
import type { MediaAsset, MetersPlanned, PlannedMaterial, WorkDailyLogRevision } from '@/types';
import { uuidV4 } from '@/utils/uuid';

type CrewOption = { id: string; name: string };

type Props = {
  workId: string;
  dailyLogId: string;
  logDate: string;
  isRepublish: boolean;
  lastRevision: WorkDailyLogRevision | null;
  crewOptions: CrewOption[];
  plannedMaterials: PlannedMaterial[];
  metersPlanned: MetersPlanned | null;
  lastRejectionReason?: string | null;
  onSubmit: (payload: PublishDailyLogInput, mediaPaths: string[]) => void;
  submitting: boolean;
  /** When set, only the matching step block is rendered (wizard UI). */
  wizardStep?: 0 | 1 | 2;
};

export function DailyLogForm({
  workId,
  dailyLogId,
  logDate,
  isRepublish,
  lastRevision,
  crewOptions,
  plannedMaterials,
  metersPlanned,
  lastRejectionReason,
  onSubmit,
  submitting,
  wizardStep,
}: Props) {
  const [photos, setPhotos] = useState<MediaAsset[]>([]);

  const defaultValues: DailyLogFormData = {
    activities: lastRevision?.activities ?? '',
    crewPresent: lastRevision?.crew_present ?? [],
    postsInstalledCount: lastRevision?.posts_installed_count ?? 0,
    metersBT: lastRevision?.meters_installed?.BT ?? 0,
    metersMT: lastRevision?.meters_installed?.MT ?? 0,
    metersRede: lastRevision?.meters_installed?.rede ?? 0,
    materialsConsumed: lastRevision?.materials_consumed ?? [],
    incidents: lastRevision?.incidents ?? '',
    rejectionReason: isRepublish
      ? `Corrigido conforme solicitado: ${lastRejectionReason ?? ''}`
      : '',
  };

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<DailyLogFormData>({
    resolver: zodResolver(dailyLogFormSchema),
    defaultValues,
  });

  const {
    fields: materialFields,
    append: appendMaterial,
    remove: removeMaterial,
  } = useFieldArray({
    control,
    name: 'materialsConsumed',
  });

  const showStep = (s: 0 | 1 | 2) => wizardStep === undefined || wizardStep === s;
  const showSubmit = wizardStep === undefined || wizardStep === 2;
  const activitiesValue = watch('activities');

  const handleAddPhoto = useCallback(async (source: 'camera' | 'gallery') => {
    if (photos.length >= DAILY_LOG_LIMITS.MAX_PHOTOS) {
      Alert.alert('Limite atingido', `Maximo de ${DAILY_LOG_LIMITS.MAX_PHOTOS} fotos.`);
      return;
    }
    const asset = await pickImage(source);
    if (asset) {
      setPhotos((prev) => [...prev, asset].slice(0, DAILY_LOG_LIMITS.MAX_PHOTOS));
    }
  }, [photos.length]);

  const handleRemovePhoto = useCallback((index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleFormSubmit = useCallback(
    (data: DailyLogFormData) => {
      const revisionId = uuidV4();
      const clientEventId = uuidV4();
      const rpcFields = formDataToRpcPayload(data);

      const media: PublishDailyLogMediaInput[] = photos.map((photo) => {
        const fileUuid = uuidV4();
        const ext = photo.fileName.split('.').pop() ?? 'jpg';
        return {
          id: uuidV4(),
          kind: 'image' as const,
          file_name: `${fileUuid}.${ext}`,
          file_size_bytes: photo.fileSize,
          mime_type: photo.mimeType,
          storage_path: dailyLogMediaPath(workId, dailyLogId, revisionId, fileUuid, ext),
          width: photo.width ?? null,
          height: photo.height ?? null,
          duration_seconds: null,
        };
      });

      const payload: PublishDailyLogInput = {
        work_id: workId,
        log_date: logDate,
        daily_log_id: dailyLogId,
        revision_id: revisionId,
        client_event_id: clientEventId,
        ...rpcFields,
        media,
      };

      const mediaPaths = photos.map((p) => p.uri);
      onSubmit(payload, mediaPaths);
    },
    [workId, dailyLogId, logDate, photos, onSubmit],
  );

  const handleAddPlannedMaterial = useCallback(
    (material: PlannedMaterial) => {
      appendMaterial({
        materialId: material.materialId,
        name: material.name,
        unit: material.unit,
        quantity: 0,
      });
    },
    [appendMaterial],
  );

  const handleAddManualMaterial = useCallback(() => {
    appendMaterial({
      materialId: uuidV4(),
      name: '',
      unit: 'un',
      quantity: 0,
    });
  }, [appendMaterial]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {showStep(0) ? (
        <>
        {/* --- Atividades --- */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Atividades *</Text>
          <Controller
            control={control}
            name="activities"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[styles.textArea, errors.activities ? styles.inputError : null]}
                multiline
                placeholder="Descreva as atividades realizadas no dia..."
                placeholderTextColor="#8c95a6"
                maxLength={DAILY_LOG_LIMITS.MAX_ACTIVITIES_LENGTH}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
              />
            )}
          />
          <View style={styles.counterRow}>
            {errors.activities ? (
              <Text style={styles.errorText}>{errors.activities.message}</Text>
            ) : <View />}
            <Text style={styles.counterText}>
              {activitiesValue.length}/{DAILY_LOG_LIMITS.MAX_ACTIVITIES_LENGTH}
            </Text>
          </View>
        </View>

        {/* --- Equipe Presente --- */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Equipe presente *</Text>
          <Controller
            control={control}
            name="crewPresent"
            render={({ field: { onChange, value } }) => (
              <View>
                {crewOptions.length > 0 ? (
                  crewOptions.map((member) => {
                    const isSelected = value.includes(member.name);
                    return (
                      <Pressable
                        key={member.id}
                        onPress={() => {
                          if (isSelected) {
                            onChange(value.filter((n: string) => n !== member.name));
                          } else {
                            onChange([...value, member.name]);
                          }
                        }}
                        style={styles.checkboxRow}
                      >
                        <View style={[styles.checkbox, isSelected ? styles.checkboxChecked : null]}>
                          {isSelected ? <Text style={styles.checkMark}>✓</Text> : null}
                        </View>
                        <Text style={styles.checkboxLabel}>{member.name}</Text>
                      </Pressable>
                    );
                  })
                ) : (
                  <Text style={styles.hintText}>
                    Equipe nao cadastrada. Digite os nomes separados por virgula.
                  </Text>
                )}
                {crewOptions.length === 0 ? (
                  <TextInput
                    style={styles.input}
                    placeholder="Jose Silva, Maria Santos..."
                    placeholderTextColor="#8c95a6"
                    onChangeText={(text) => {
                      const names = text
                        .split(',')
                        .map((n) => n.trim())
                        .filter(Boolean);
                      onChange(names);
                    }}
                  />
                ) : null}
              </View>
            )}
          />
          {errors.crewPresent ? (
            <Text style={styles.errorText}>{errors.crewPresent.message}</Text>
          ) : null}
        </View>

        {/* --- Postes Instalados --- */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Postes instalados</Text>
          <Controller
            control={control}
            name="postsInstalledCount"
            render={({ field: { onChange, value } }) => (
              <TextInput
                style={[styles.input, styles.numericInput]}
                keyboardType="numeric"
                value={String(value)}
                onChangeText={(t) => onChange(parseInt(t, 10) || 0)}
              />
            )}
          />
        </View>

        </>
        ) : null}

        {showStep(1) ? (
        <>
        {/* --- Metragem Instalada --- */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Metragem instalada (metros)</Text>
          {metersPlanned ? (
            <Text style={styles.hintText}>
              Planejado: BT {metersPlanned.BT}m / MT {metersPlanned.MT}m / Rede{' '}
              {metersPlanned.rede}m
            </Text>
          ) : null}
          <View style={styles.metersRow}>
            {(['metersBT', 'metersMT', 'metersRede'] as const).map((field) => {
              const label = field === 'metersBT' ? 'BT' : field === 'metersMT' ? 'MT' : 'Rede';
              return (
                <View key={field} style={styles.meterField}>
                  <Text style={styles.meterLabel}>{label}</Text>
                  <Controller
                    control={control}
                    name={field}
                    render={({ field: { onChange, value } }) => (
                      <TextInput
                        style={[styles.input, styles.numericInput]}
                        keyboardType="decimal-pad"
                        value={String(value)}
                        onChangeText={(t) => onChange(parseFloat(t) || 0)}
                      />
                    )}
                  />
                </View>
              );
            })}
          </View>
        </View>

        {/* --- Materiais Consumidos --- */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Materiais consumidos</Text>
          {materialFields.map((field, index) => (
            <View key={field.id} style={styles.materialRow}>
              <View style={styles.materialInfo}>
                <Controller
                  control={control}
                  name={`materialsConsumed.${index}.name`}
                  render={({ field: { onChange, value } }) => (
                    <TextInput
                      style={[styles.input, styles.materialNameInput]}
                      placeholder="Material"
                      placeholderTextColor="#8c95a6"
                      value={value}
                      onChangeText={onChange}
                    />
                  )}
                />
                <View style={styles.materialQtyRow}>
                  <Controller
                    control={control}
                    name={`materialsConsumed.${index}.quantity`}
                    render={({ field: { onChange, value } }) => (
                      <TextInput
                        style={[styles.input, styles.numericInput, styles.materialQtyInput]}
                        keyboardType="decimal-pad"
                        placeholder="Qtd"
                        placeholderTextColor="#8c95a6"
                        value={value > 0 ? String(value) : ''}
                        onChangeText={(t) => onChange(parseFloat(t) || 0)}
                      />
                    )}
                  />
                  <Controller
                    control={control}
                    name={`materialsConsumed.${index}.unit`}
                    render={({ field: { onChange, value } }) => (
                      <TextInput
                        style={[styles.input, styles.materialUnitInput]}
                        placeholder="un"
                        placeholderTextColor="#8c95a6"
                        value={value}
                        onChangeText={onChange}
                      />
                    )}
                  />
                </View>
              </View>
              <Pressable onPress={() => removeMaterial(index)} style={styles.removeBtn}>
                <Text style={styles.removeBtnText}>X</Text>
              </Pressable>
            </View>
          ))}
          <View style={styles.addMaterialRow}>
            {plannedMaterials.length > 0 ? (
              <Pressable
                onPress={() => {
                  const used = new Set(materialFields.map((f) => f.materialId));
                  const available = plannedMaterials.filter((m) => !used.has(m.materialId));
                  if (available.length === 0) {
                    handleAddManualMaterial();
                    return;
                  }
                  Alert.alert('Adicionar material', 'Escolha um material planejado', [
                    ...available.slice(0, 8).map((m) => ({
                      text: `${m.name} (${m.unit})`,
                      onPress: () => handleAddPlannedMaterial(m),
                    })),
                    { text: 'Outro (manual)', onPress: handleAddManualMaterial },
                    { text: 'Cancelar', style: 'cancel' as const },
                  ]);
                }}
                style={styles.addBtn}
              >
                <Text style={styles.addBtnText}>+ Adicionar material</Text>
              </Pressable>
            ) : (
              <Pressable onPress={handleAddManualMaterial} style={styles.addBtn}>
                <Text style={styles.addBtnText}>+ Adicionar material</Text>
              </Pressable>
            )}
          </View>
        </View>

        </>
        ) : null}

        {showStep(2) ? (
        <>
        {/* --- Incidentes --- */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Incidentes</Text>
          <Controller
            control={control}
            name="incidents"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={styles.textArea}
                multiline
                placeholder="Nenhum incidente? Deixe em branco."
                placeholderTextColor="#8c95a6"
                maxLength={DAILY_LOG_LIMITS.MAX_INCIDENTS_LENGTH}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
              />
            )}
          />
        </View>

        {/* --- Fotos --- */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Fotos ({photos.length}/{DAILY_LOG_LIMITS.MAX_PHOTOS})
          </Text>
          <View style={styles.photoGrid}>
            {photos.map((photo, i) => (
              <View key={i} style={styles.photoItem}>
                <Image source={{ uri: photo.uri }} style={styles.photoThumb} />
                <Pressable onPress={() => handleRemovePhoto(i)} style={styles.photoRemoveBtn}>
                  <Text style={styles.photoRemoveText}>X</Text>
                </Pressable>
              </View>
            ))}
          </View>
          {photos.length < DAILY_LOG_LIMITS.MAX_PHOTOS ? (
            <View style={styles.photoActions}>
              <Pressable onPress={() => void handleAddPhoto('camera')} style={styles.addBtn}>
                <Text style={styles.addBtnText}>Camera</Text>
              </Pressable>
              <Pressable onPress={() => void handleAddPhoto('gallery')} style={styles.addBtn}>
                <Text style={styles.addBtnText}>Galeria</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {/* --- Motivo de Correcao (republish only) --- */}
        {isRepublish ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Motivo da correcao</Text>
            <Controller
              control={control}
              name="rejectionReason"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={styles.textArea}
                  multiline
                  placeholder="Descreva o que foi corrigido..."
                  placeholderTextColor="#8c95a6"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                />
              )}
            />
          </View>
        ) : null}

        </>
        ) : null}

        {showSubmit ? (
          <>
            <Pressable
              onPress={handleSubmit(handleFormSubmit)}
              disabled={submitting}
              style={({ pressed }) => [
                styles.submitBtn,
                submitting ? styles.submitBtnDisabled : null,
                pressed ? styles.submitBtnPressed : null,
              ]}
              accessibilityRole="button"
              accessibilityLabel={isRepublish ? 'Republicar diario' : 'Publicar diario'}
            >
              <Text style={styles.submitBtnText}>
                {submitting
                  ? 'Enviando...'
                  : isRepublish
                    ? 'Republicar diario'
                    : 'Publicar diario'}
              </Text>
            </Pressable>
          </>
        ) : null}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1c1f24',
    marginBottom: 8,
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#e3e8ef',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1c1f24',
    backgroundColor: '#ffffff',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e3e8ef',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1c1f24',
    backgroundColor: '#ffffff',
  },
  inputError: {
    borderColor: '#c0392b',
  },
  numericInput: {
    minWidth: 70,
  },
  counterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  counterText: {
    fontSize: 12,
    color: '#5a6473',
  },
  errorText: {
    fontSize: 12,
    color: '#c0392b',
  },
  hintText: {
    fontSize: 13,
    color: '#5a6473',
    marginBottom: 8,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#c5cdd8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#0a3a82',
    borderColor: '#0a3a82',
  },
  checkMark: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  checkboxLabel: {
    fontSize: 15,
    color: '#1c1f24',
  },
  metersRow: {
    flexDirection: 'row',
    gap: 12,
  },
  meterField: {
    flex: 1,
  },
  meterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5a6473',
    marginBottom: 4,
  },
  materialRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e3e8ef',
    borderRadius: 10,
    padding: 10,
  },
  materialInfo: {
    flex: 1,
    gap: 6,
  },
  materialNameInput: {
    flex: 1,
  },
  materialQtyRow: {
    flexDirection: 'row',
    gap: 8,
  },
  materialQtyInput: {
    flex: 1,
  },
  materialUnitInput: {
    width: 60,
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fdecea',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnText: {
    color: '#c0392b',
    fontWeight: '700',
    fontSize: 12,
  },
  addMaterialRow: {
    marginTop: 4,
  },
  addBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#e3effc',
    alignItems: 'center',
  },
  addBtnText: {
    color: '#0a3a82',
    fontWeight: '600',
    fontSize: 14,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  photoItem: {
    position: 'relative',
  },
  photoThumb: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  photoRemoveBtn: {
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
  photoRemoveText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  photoActions: {
    flexDirection: 'row',
    gap: 12,
  },
  submitBtn: {
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: '#0a3a82',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: {
    backgroundColor: '#a0b4d4',
  },
  submitBtnPressed: {
    backgroundColor: '#072a60',
  },
  submitBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
  bottomSpacer: {
    height: 40,
  },
});
