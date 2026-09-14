'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  FileText,
  Flag,
  ListChecks,
  MapPin,
  MessageCircle,
  RefreshCw,
  Wifi,
  WifiOff,
  Wrench,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import { Text } from '@/design-system/primitives/Text';
import { colors } from '@/design-system/tokens/colors';
import { radius } from '@/design-system/tokens/radius';
import { spacing } from '@/design-system/tokens/spacing';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import {
  discardItem,
  getAllItems,
  outboxEmitter,
  retryFailedItem,
} from '@/lib/offline/outbox';
import { runSyncCycle } from '@/lib/offline/sync-worker';
import type { OutboxItem, OutboxStatus } from '@/types';
import { relativeTimePtBr } from '@/utils/relativeTime';

type ActionMeta = { label: string; icon: LucideIcon; tint: string; bg: string };

const ACTION_META: Record<string, ActionMeta> = {
  send_message: { label: 'Mensagem', icon: MessageCircle, tint: colors.textSecondary, bg: colors.neutralBg },
  record_pole_installation: { label: 'Poste', icon: MapPin, tint: colors.primary, bg: colors.infoBg },
  remove_pole_installation: { label: 'Remoção de poste', icon: MapPin, tint: colors.textSecondary, bg: colors.neutralBg },
  publish_daily_log: { label: 'Diário', icon: FileText, tint: colors.textSecondary, bg: colors.neutralBg },
  report_milestone: { label: 'Marco', icon: Flag, tint: colors.success, bg: colors.successBg },
  set_milestone_in_progress: { label: 'Início de marco', icon: Flag, tint: colors.success, bg: colors.successBg },
  mark_checklist_item: { label: 'Checklist', icon: ListChecks, tint: colors.success, bg: colors.successBg },
  set_checklist_in_progress: { label: 'Início de checklist', icon: ListChecks, tint: colors.success, bg: colors.successBg },
  open_alert: { label: 'Alerta', icon: AlertTriangle, tint: colors.danger, bg: colors.dangerBg },
  resolve_alert_in_field: { label: 'Alerta resolvido', icon: AlertTriangle, tint: colors.danger, bg: colors.dangerBg },
  add_alert_comment: { label: 'Comentário em alerta', icon: AlertTriangle, tint: colors.danger, bg: colors.dangerBg },
  record_pole_equipment: { label: 'Equipamento', icon: Wrench, tint: colors.primary, bg: colors.infoBg },
};

function metaFor(actionType: string): ActionMeta {
  return (
    ACTION_META[actionType] ?? {
      label: actionType,
      icon: FileText,
      tint: colors.textSecondary,
      bg: colors.neutralBg,
    }
  );
}

const ACTIVE: OutboxStatus[] = ['pending', 'uploading_media', 'calling_rpc'];

/**
 * Fila de envio.
 *
 * A tela existe para uma pergunta so: "o que ainda nao chegou, e o que eu
 * preciso decidir?". Por isso o topo e o estado da conexao, o meio e o que
 * espera, e so o que falhou de vez ganha botao — item esperando nao precisa
 * de acao nenhuma do gerente.
 *
 * O que ja sincronizou some daqui: vira historico em Registros, dentro da
 * obra, que e onde faz sentido reler.
 */
export default function FilaScreen() {
  const insets = useSafeAreaInsets();
  const { isOnline } = useNetworkStatus();
  const [items, setItems] = useState<OutboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadItems = useCallback(async () => {
    try {
      setItems(await getAllItems());
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadItems();
    return outboxEmitter.subscribe(() => void loadItems());
  }, [loadItems]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadItems();
    setRefreshing(false);
  }, [loadItems]);

  const handleRetryAll = useCallback(async () => {
    await runSyncCycle();
    await loadItems();
  }, [loadItems]);

  const handleDiscard = useCallback(
    (item: OutboxItem) => {
      Alert.alert(
        'Descartar registro',
        `"${metaFor(item.action_type).label}" será apagado do aparelho e nunca chegará ao portal. Não dá para desfazer.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Descartar',
            style: 'destructive',
            onPress: () => void discardItem(item.id).then(loadItems),
          },
        ],
      );
    },
    [loadItems],
  );

  const { waiting, failed, lastSynced } = useMemo(() => {
    const w = items.filter((i) => ACTIVE.includes(i.status));
    const f = items.filter((i) => i.status === 'failed');
    const s = items
      .filter((i) => i.status === 'synced' && i.synced_at)
      .sort((a, b) => String(b.synced_at).localeCompare(String(a.synced_at)))[0];
    return { waiting: w, failed: f, lastSynced: s };
  }, [items]);

  const total = waiting.length + failed.length;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
        <Text variant="heading2">Fila de envio</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void handleRefresh()}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Estado da conexao: o que explica tudo o que vem abaixo. */}
        {!isOnline ? (
          <View style={[styles.connBox, styles.connWarn]}>
            <View style={styles.connRow}>
              <WifiOff size={24} color={colors.warning} strokeWidth={1.9} />
              <View style={styles.connLabels}>
                <Text variant="bodyLargeBold" style={{ color: colors.warningText }}>Sem sinal</Text>
                <Text variant="caption" style={{ color: colors.warningText }}>
                  Nada se perde. Envia sozinho quando voltar.
                </Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => void handleRetryAll()}
              style={({ pressed }) => [styles.connBtn, { opacity: pressed ? 0.8 : 1 }]}
            >
              <RefreshCw size={18} color={colors.warningText} strokeWidth={2.1} />
              <Text variant="bodyBold" style={{ color: colors.warningText }}>Tentar agora</Text>
            </Pressable>
          </View>
        ) : total > 0 ? (
          <View style={[styles.connBox, styles.connInfo]}>
            <View style={styles.connRow}>
              <Wifi size={24} color={colors.primary} strokeWidth={1.9} />
              <View style={styles.connLabels}>
                <Text variant="bodyLargeBold" style={{ color: colors.infoText }}>Conectado</Text>
                <Text variant="caption" style={{ color: colors.infoText }}>Enviando o que falta.</Text>
              </View>
            </View>
          </View>
        ) : null}

        {loading ? (
          <Text variant="body" color="textSecondary">Carregando...</Text>
        ) : total === 0 ? (
          <View style={styles.clear}>
            <CheckCircle2 size={40} color={colors.success} strokeWidth={1.9} />
            <Text variant="heading3">Tudo enviado</Text>
            <Text variant="body" color="textSecondary" style={styles.center}>
              {lastSynced?.synced_at
                ? `Último envio ${relativeTimePtBr(lastSynced.synced_at)}.`
                : 'Não há nada esperando no aparelho.'}
            </Text>
          </View>
        ) : (
          <>
            {waiting.length > 0 ? (
              <View style={styles.section}>
                <Text variant="label" color="textMuted">
                  {waiting.length === 1 ? 'ESPERANDO · 1' : `ESPERANDO · ${waiting.length}`}
                </Text>
                {waiting.map((item) => {
                  const meta = metaFor(item.action_type);
                  const Icon = meta.icon;
                  return (
                    <View key={item.id} style={styles.item}>
                      <View style={[styles.itemIcon, { backgroundColor: meta.bg }]}>
                        <Icon size={20} color={meta.tint} strokeWidth={1.9} />
                      </View>
                      <View style={styles.itemLabels}>
                        <Text variant="bodyLargeBold" numberOfLines={1}>{meta.label}</Text>
                        <Text variant="caption" color="textSecondary">
                          {relativeTimePtBr(item.created_at)}
                        </Text>
                      </View>
                      <Text variant="caption" color="textMuted">
                        {item.status === 'pending' ? 'na fila' : 'enviando'}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : null}

            {/* So o que desistiu sozinho pede decisao humana. */}
            {failed.length > 0 ? (
              <View style={styles.section}>
                <Text variant="label" style={{ color: colors.dangerText }}>
                  {failed.length === 1 ? 'PRECISA DE VOCÊ · 1' : `PRECISA DE VOCÊ · ${failed.length}`}
                </Text>
                {failed.map((item) => {
                  const meta = metaFor(item.action_type);
                  const Icon = meta.icon;
                  return (
                    <View key={item.id} style={[styles.item, styles.itemFailed]}>
                      <View style={styles.itemHead}>
                        <View style={[styles.itemIcon, { backgroundColor: colors.dangerBg }]}>
                          <CircleAlert size={20} color={colors.danger} strokeWidth={2} />
                        </View>
                        <View style={styles.itemLabels}>
                          <View style={styles.itemTitleRow}>
                            <Icon size={15} color={colors.textMuted} strokeWidth={1.9} />
                            <Text variant="bodyLargeBold" numberOfLines={1}>{meta.label}</Text>
                          </View>
                          <Text variant="caption" style={{ color: colors.dangerText }}>
                            {`falhou ${item.attempts}x · ${relativeTimePtBr(item.created_at)}`}
                          </Text>
                          {item.last_error ? (
                            <Text variant="caption" color="textMuted" numberOfLines={3}>
                              {item.last_error}
                            </Text>
                          ) : null}
                        </View>
                      </View>

                      <View style={styles.itemActions}>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => void retryFailedItem(item.id).then(loadItems)}
                          style={({ pressed }) => [styles.actionBtn, styles.actionRetry, { opacity: pressed ? 0.8 : 1 }]}
                        >
                          <Text variant="bodyBold" color="textSecondary">Tentar de novo</Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => handleDiscard(item)}
                          style={({ pressed }) => [styles.actionBtn, styles.actionDiscard, { opacity: pressed ? 0.8 : 1 }]}
                        >
                          <Text variant="bodyBold" style={{ color: colors.dangerText }}>Descartar</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : null}

            {lastSynced?.synced_at ? (
              <View style={styles.footnote}>
                <CheckCircle2 size={18} color={colors.success} strokeWidth={2.1} />
                <Text variant="body" style={{ color: colors.successText }}>
                  {`Último envio confirmado ${relativeTimePtBr(lastSynced.synced_at)}`}
                </Text>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceMuted },
  header: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
  content: { padding: spacing.xl, paddingBottom: spacing.huge, gap: spacing.xl },

  connBox: { borderRadius: radius.xl, padding: spacing.lg, gap: spacing.lg, borderWidth: 1 },
  connWarn: { backgroundColor: colors.warningBg, borderColor: colors.warningBorder },
  connInfo: { backgroundColor: colors.infoBg, borderColor: colors.infoBorder },
  connRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  connLabels: { flex: 1, gap: 2 },
  connBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.warningBorder,
  },

  section: { gap: spacing.md },

  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 64,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },
  itemFailed: { flexDirection: 'column', alignItems: 'stretch', gap: spacing.md, borderColor: colors.dangerBorder },
  itemHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  itemIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  itemLabels: { flex: 1, gap: 3 },
  itemTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  itemActions: { flexDirection: 'row', gap: spacing.sm },
  actionBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  actionRetry: { backgroundColor: colors.surface, borderColor: colors.borderStrong },
  actionDiscard: { backgroundColor: colors.dangerBg, borderColor: colors.dangerBorder },

  clear: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.huge },
  center: { textAlign: 'center' },

  footnote: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
});
