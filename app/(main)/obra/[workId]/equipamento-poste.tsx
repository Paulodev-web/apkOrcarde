'use client';

import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Check, Package, Plus } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ObraHeader } from '@/components/obra/ObraHeader';
import { LoadingState } from '@/design-system/composed/LoadingState';
import { Button } from '@/design-system/primitives/Button';
import { Text } from '@/design-system/primitives/Text';
import { TextInput } from '@/design-system/primitives/TextInput';
import { colors } from '@/design-system/tokens/colors';
import { radius } from '@/design-system/tokens/radius';
import { spacing } from '@/design-system/tokens/spacing';
import { enqueue } from '@/lib/offline/outbox';
import { supabase } from '@/lib/supabase/client';
import type { RecordPoleEquipmentInput } from '@/types/rpc';
import { uuidV4 } from '@/utils/uuid';

type Previsto = { label: string; quantity: number };

/**
 * O catalogo do poste vem do projeto. O ganho e esse: o gerente nao digita
 * nome de estrutura no sol — ele confere o que ja estava previsto.
 */
async function fetchPrevistos(workId: string): Promise<Previsto[]> {
  const { data, error } = await supabase
    .from('work_project_snapshot')
    .select('materials_planned')
    .eq('work_id', workId)
    .maybeSingle();

  // Erro de leitura não pode virar "o projeto não prevê nada neste poste": o
  // gerente marcaria tudo como fora do projeto.
  if (error) throw new Error(error.message);
  if (!data?.materials_planned) return [];
  const planned = data.materials_planned as { code?: string; name?: string; qty?: number }[];
  return planned.map((m) => ({
    label: m.code ?? m.name ?? 'estrutura',
    quantity: typeof m.qty === 'number' ? m.qty : 1,
  }));
}

async function fetchJaMontado(installationId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('work_pole_equipment')
    .select('work_pole_equipment_items(label)')
    .eq('installation_id', installationId);

  if (error || !data) return new Set();
  const labels = new Set<string>();
  for (const row of data as { work_pole_equipment_items: { label: string }[] | null }[]) {
    for (const item of row.work_pole_equipment_items ?? []) labels.add(item.label);
  }
  return labels;
}

export default function EquipamentoPosteScreen() {
  const params = useLocalSearchParams<{
    workId: string;
    installationId: string;
    numbering: string;
  }>();
  const workId = typeof params.workId === 'string' ? params.workId : '';
  const installationId = typeof params.installationId === 'string' ? params.installationId : '';
  const numbering = typeof params.numbering === 'string' ? params.numbering : 'poste';
  const router = useRouter();

  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [extras, setExtras] = useState<string[]>([]);
  const [novoExtra, setNovoExtra] = useState('');
  const [salvando, setSalvando] = useState(false);

  const previstosQuery = useQuery({
    queryKey: ['catalogoPoste', workId],
    queryFn: () => fetchPrevistos(workId),
    enabled: workId.length > 0,
  });

  const montadosQuery = useQuery({
    queryKey: ['jaMontado', installationId],
    queryFn: () => fetchJaMontado(installationId),
    enabled: installationId.length > 0,
  });

  const jaMontado = montadosQuery.data ?? new Set<string>();
  const previstos = previstosQuery.data ?? [];

  const alternar = useCallback((label: string) => {
    setMarcados((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }, []);

  const total = marcados.size + extras.length;

  const restantes = useMemo(
    () => previstos.filter((p) => !jaMontado.has(p.label)).length,
    [previstos, jaMontado],
  );

  const salvar = useCallback(async () => {
    if (total === 0) return;
    setSalvando(true);
    try {
      const clientEventId = uuidV4();
      const payload: RecordPoleEquipmentInput = {
        work_id: workId,
        equipment_id: uuidV4(),
        installation_id: installationId,
        notes: null,
        installed_at: new Date().toISOString(),
        client_event_id: clientEventId,
        items: [
          ...[...marcados].map((label) => ({
            material_id: null,
            label,
            quantity: previstos.find((p) => p.label === label)?.quantity ?? 1,
            from_project: true,
          })),
          ...extras.map((label) => ({
            material_id: null,
            label,
            quantity: 1,
            from_project: false,
          })),
        ],
        media: [],
      };

      // Grava no aparelho antes de qualquer rede: a partir daqui o registro
      // existe para o gerente, mesmo que o envio demore horas.
      await enqueue({
        client_event_id: clientEventId,
        action_type: 'record_pole_equipment',
        payload,
      });

      router.back();
    } catch {
      Alert.alert('Erro', 'Não foi possível guardar o registro. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  }, [total, workId, installationId, marcados, extras, previstos, router]);

  return (
    <View style={styles.root}>
      <ObraHeader title={numbering} subtitle="O que foi montado?" />

      {previstosQuery.isLoading ? (
        <LoadingState />
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            <Text variant="label" color="textMuted">
              {previstos.length > 0 ? `PREVISTO NO PROJETO · ${restantes} a montar` : 'PREVISTO NO PROJETO'}
            </Text>

            {previstos.length === 0 ? (
              <Text variant="body" color="textSecondary">
                O projeto desta obra não trouxe catálogo de estruturas. Use o campo abaixo para
                registrar o que montou.
              </Text>
            ) : (
              <View style={styles.lista}>
                {previstos.map((item) => {
                  const feito = jaMontado.has(item.label);
                  const marcado = marcados.has(item.label);
                  return (
                    <Pressable
                      key={item.label}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: feito || marcado, disabled: feito }}
                      disabled={feito}
                      onPress={() => alternar(item.label)}
                      style={({ pressed }) => [
                        styles.item,
                        marcado && styles.itemAtivo,
                        feito && styles.itemFeito,
                        { opacity: pressed && !feito ? 0.7 : feito ? 0.55 : 1 },
                      ]}
                    >
                      <View
                        style={[
                          styles.box,
                          marcado && styles.boxAtivo,
                          feito && styles.boxFeito,
                        ]}
                      >
                        {feito || marcado ? (
                          <Check
                            size={16}
                            color={feito ? colors.successText : colors.textInverse}
                            strokeWidth={3}
                          />
                        ) : null}
                      </View>
                      <Text variant="bodyLargeBold" style={styles.itemLabel} numberOfLines={1}>
                        {item.label}
                      </Text>
                      <Text
                        variant="caption"
                        color={feito ? 'successText' : 'textSecondary'}
                        numberOfLines={1}
                        style={styles.itemMeta}
                      >
                        {feito ? 'montado' : `${item.quantity} un`}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {/* Divergencia entre projeto e execucao: o engenheiro precisa ver. */}
            <Text variant="label" color="textMuted" style={styles.secao}>
              MONTEI FORA DO PROJETO
            </Text>
            {extras.map((label) => (
              <View key={label} style={[styles.item, styles.itemExtra]}>
                <Package size={20} color={colors.warning} strokeWidth={1.9} />
                <Text variant="bodyLargeBold" style={styles.itemLabel}>{label}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remover ${label}`}
                  onPress={() => setExtras((prev) => prev.filter((e) => e !== label))}
                  hitSlop={10}
                >
                  <Text variant="captionBold" style={{ color: colors.dangerText }}>remover</Text>
                </Pressable>
              </View>
            ))}
            <View style={styles.extraRow}>
              <View style={styles.extraInput}>
                <TextInput
                  value={novoExtra}
                  onChangeText={setNovoExtra}
                  placeholder="Código da estrutura"
                  autoCapitalize="characters"
                />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Adicionar estrutura fora do projeto"
                disabled={novoExtra.trim().length === 0}
                onPress={() => {
                  const v = novoExtra.trim().toUpperCase();
                  if (v && !extras.includes(v)) setExtras((prev) => [...prev, v]);
                  setNovoExtra('');
                }}
                style={({ pressed }) => [
                  styles.extraBtn,
                  { opacity: novoExtra.trim().length === 0 ? 0.4 : pressed ? 0.8 : 1 },
                ]}
              >
                <Plus size={22} color={colors.primary} strokeWidth={2.2} />
              </Pressable>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Button
              block
              size="lg"
              icon={Check}
              loading={salvando}
              disabled={total === 0}
              onPress={() => void salvar()}
            >
              {total === 0
                ? 'Marque o que montou'
                : total === 1
                  ? 'Salvar 1 estrutura'
                  : `Salvar ${total} estruturas`}
            </Button>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceMuted },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.md },
  secao: { marginTop: spacing.lg },
  lista: { gap: spacing.sm },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 60,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },
  itemAtivo: { borderColor: colors.borderAccent, backgroundColor: colors.infoBg },
  itemFeito: { borderColor: colors.successBorder, backgroundColor: colors.successBg },
  itemExtra: { borderColor: colors.warningBorder, backgroundColor: colors.warningBg },
  itemLabel: { flex: 1 },
  box: {
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxAtivo: { backgroundColor: colors.primary, borderColor: colors.primary },
  boxFeito: { backgroundColor: 'transparent', borderColor: colors.successBorder },
  itemMeta: { maxWidth: 96, textAlign: 'right' },
  extraRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  extraInput: { flex: 1 },
  extraBtn: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
});
