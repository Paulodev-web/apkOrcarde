'use client';

import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowRight, Check } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ObraHeader } from '@/components/obra/ObraHeader';
import { Button } from '@/design-system/primitives/Button';
import { Text } from '@/design-system/primitives/Text';
import { TextInput } from '@/design-system/primitives/TextInput';
import { colors } from '@/design-system/tokens/colors';
import { radius } from '@/design-system/tokens/radius';
import { spacing } from '@/design-system/tokens/spacing';
import { captureGps } from '@/lib/location/gps';
import { enqueue } from '@/lib/offline/outbox';
import type { RecordNetworkSpanInput } from '@/types/rpc';
import { uuidV4 } from '@/utils/uuid';

type Categoria = 'BT' | 'MT' | 'iluminacao';

const CATEGORIAS: { key: Categoria; label: string }[] = [
  { key: 'BT', label: 'BT' },
  { key: 'MT', label: 'MT' },
  { key: 'iluminacao', label: 'Iluminação' },
];

/**
 * Confirmação do trecho lançado.
 *
 * Categoria, metragem e cabo já chegam preenchidos pelo projeto — o gerente
 * confirma ou corrige. A metragem que vale para medição é a que ele digita:
 * `meters_planned` fica guardada ao lado para o engenheiro ver a diferença.
 */
export default function RedeTrechoScreen() {
  const params = useLocalSearchParams<{
    workId: string;
    connectionId: string;
    origem: string;
    destino: string;
    categoria: string;
    metros: string;
    cabo: string;
  }>();

  const workId = typeof params.workId === 'string' ? params.workId : '';
  const connectionId = typeof params.connectionId === 'string' ? params.connectionId : '';
  const origem = typeof params.origem === 'string' ? params.origem : '—';
  const destino = typeof params.destino === 'string' ? params.destino : '—';
  const metrosProjeto = typeof params.metros === 'string' ? params.metros : '';
  const caboProjeto = typeof params.cabo === 'string' ? params.cabo : '';

  const router = useRouter();
  const [categoria, setCategoria] = useState<Categoria>(
    params.categoria === 'MT' || params.categoria === 'iluminacao' ? params.categoria : 'BT',
  );
  const [metros, setMetros] = useState(metrosProjeto);
  const [cabo, setCabo] = useState(caboProjeto);
  const [notas, setNotas] = useState('');
  const [salvando, setSalvando] = useState(false);

  const metrosNum = Number(metros.replace(',', '.'));
  const valido = Number.isFinite(metrosNum) && metrosNum > 0;

  const salvar = useCallback(async () => {
    if (!valido) return;
    setSalvando(true);
    try {
      // GPS nunca bloqueia: se não vier, o registro vai sem coordenada.
      const gps = await captureGps().catch(() => null);
      const clientEventId = uuidV4();

      const payload: RecordNetworkSpanInput = {
        work_id: workId,
        span_id: uuidV4(),
        connection_id: connectionId || null,
        from_post_id: null,
        to_post_id: null,
        category: categoria,
        meters: metrosNum,
        meters_planned: metrosProjeto ? Number(metrosProjeto) : null,
        cable_type: cabo.trim() || null,
        notes: notas.trim() || null,
        gps_lat: gps?.latitude ?? null,
        gps_lng: gps?.longitude ?? null,
        installed_at: new Date().toISOString(),
        client_event_id: clientEventId,
        media: [],
      };

      await enqueue({
        client_event_id: clientEventId,
        action_type: 'record_network_span',
        payload,
      });

      router.back();
    } catch {
      Alert.alert('Erro', 'Não foi possível guardar o trecho. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  }, [valido, workId, connectionId, categoria, metrosNum, metrosProjeto, cabo, notas, router]);

  const divergente =
    metrosProjeto.length > 0 && valido && Math.abs(metrosNum - Number(metrosProjeto)) >= 1;

  return (
    <View style={styles.root}>
      <ObraHeader title={`${origem} → ${destino}`} subtitle="Confirmar trecho" />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.trechoCard}>
          <Text variant="heading3">{origem}</Text>
          <ArrowRight size={20} color={colors.textMuted} strokeWidth={2} />
          <Text variant="heading3">{destino}</Text>
        </View>

        <View style={styles.campo}>
          <Text variant="label" color="textMuted">CATEGORIA</Text>
          <View style={styles.chips}>
            {CATEGORIAS.map((c) => {
              const ativo = categoria === c.key;
              return (
                <Pressable
                  key={c.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: ativo }}
                  onPress={() => setCategoria(c.key)}
                  style={[styles.chip, ativo ? styles.chipAtivo : styles.chipInerte]}
                >
                  <Text variant="bodyBold" color={ativo ? 'textInverse' : 'textSecondary'}>
                    {c.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.campo}>
          <Text variant="label" color="textMuted">METRAGEM LANÇADA</Text>
          <TextInput
            value={metros}
            onChangeText={setMetros}
            keyboardType="numeric"
            placeholder="0"
            helperText={metrosProjeto ? `Projeto previa ${metrosProjeto} m` : undefined}
          />
          {divergente ? (
            <View style={styles.aviso}>
              <Text variant="caption" style={{ color: colors.warningText }}>
                Diferente do projeto. O engenheiro vai ver as duas medidas.
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.campo}>
          <Text variant="label" color="textMuted">CABO</Text>
          <TextInput value={cabo} onChangeText={setCabo} placeholder="Tipo do cabo" />
        </View>

        <View style={styles.campo}>
          <Text variant="label" color="textMuted">OBSERVAÇÃO</Text>
          <TextInput
            value={notas}
            onChangeText={setNotas}
            placeholder="Opcional"
            multiline
            numberOfLines={3}
            maxLength={1000}
          />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          block
          size="lg"
          icon={Check}
          loading={salvando}
          disabled={!valido}
          onPress={() => void salvar()}
        >
          {valido ? 'Confirmar trecho' : 'Informe a metragem'}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceMuted },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.xl },
  trechoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    minHeight: 72,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },
  campo: { gap: spacing.sm },
  chips: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    flex: 1,
    minHeight: 52,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipAtivo: { backgroundColor: colors.primary },
  chipInerte: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong },
  aviso: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.warningBg,
    borderWidth: 1,
    borderColor: colors.warningBorder,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
});
