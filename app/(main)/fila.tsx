import { DrawerActions, useNavigation } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Menu } from 'lucide-react-native';

import { Button } from '@/design-system/primitives/Button';
import { Text } from '@/design-system/primitives/Text';
import { Card } from '@/design-system/primitives/Card';
import { SyncStatusIcon } from '@/design-system/composed/SyncStatusIcon';
import { SectionHeader } from '@/design-system/composed/SectionHeader';
import { ScreenContainer } from '@/design-system/layouts/ScreenContainer';
import { ScreenHeader } from '@/design-system/layouts/ScreenHeader';
import { colors } from '@/design-system/tokens/colors';
import { spacing } from '@/design-system/tokens/spacing';
import {
  getAllItems,
  retryFailedItem,
  discardItem,
  outboxEmitter,
} from '@/lib/offline/outbox';
import type { OutboxItem, OutboxStatus } from '@/types';
import { relativeTimePtBr } from '@/utils/relativeTime';

const ACTION_LABELS: Record<string, string> = {
  send_message: 'Envio de mensagem',
  record_pole_installation: 'Marcação de poste',
  remove_pole_installation: 'Remoção de poste',
  publish_daily_log: 'Publicação de diário',
  report_milestone: 'Reporte de marco',
  set_milestone_in_progress: 'Início de marco',
  mark_checklist_item: 'Marcação de checklist',
  set_checklist_in_progress: 'Início de checklist',
  open_alert: 'Abertura de alerta',
  resolve_alert_in_field: 'Resolução de alerta',
  add_alert_comment: 'Comentário em alerta',
};

const ACTIVE: OutboxStatus[] = ['pending', 'uploading_media', 'calling_rpc'];

function isActiveStatus(s: OutboxStatus): boolean {
  return ACTIVE.includes(s);
}

export default function FilaScreen() {
  const navigation = useNavigation();
  const [items, setItems] = useState<OutboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadItems = useCallback(async () => {
    try {
      const data = await getAllItems();
      setItems(data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadItems();
    const unsub = outboxEmitter.subscribe(() => void loadItems());
    return unsub;
  }, [loadItems]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadItems();
    setRefreshing(false);
  }, [loadItems]);

  const handleRetry = useCallback(
    (item: OutboxItem) => {
      void retryFailedItem(item.id).then(loadItems);
    },
    [loadItems],
  );

  const handleDiscard = useCallback(
    (item: OutboxItem) => {
      Alert.alert(
        'Descartar acao',
        `Tem certeza que deseja descartar "${ACTION_LABELS[item.action_type] ?? item.action_type}"? Esta acao nao pode ser desfeita.`,
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

  const { pendingList, failedList, syncedRecent } = useMemo(() => {
    const pending = items.filter((i) => isActiveStatus(i.status));
    const failed = items.filter((i) => i.status === 'failed');
    const synced = items
      .filter((i) => i.status === 'synced' && i.synced_at)
      .sort((a, b) => String(b.synced_at).localeCompare(String(a.synced_at)))
      .slice(0, 10);
    return { pendingList: pending, failedList: failed, syncedRecent: synced };
  }, [items]);

  return (
    <ScreenContainer scrollable={false} noPadding background="muted">
      <ScreenHeader
        title="Fila de sincronização"
        leftAction={{
          icon: Menu,
          onPress: () => navigation.dispatch(DrawerActions.openDrawer()),
          accessibilityLabel: 'Abrir menu',
        }}
      />
      {loading ? (
        <View style={styles.pad}>
          <Text variant="body" color="textSecondary">
            Carregando...
          </Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.pad}>
          <Text variant="heading3" color="textPrimary">
            Fila vazia
          </Text>
          <Text variant="body" color="textSecondary" style={styles.sub}>
            Todas as acoes foram sincronizadas com sucesso.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void handleRefresh()}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          <View style={styles.pad}>
            <SectionHeader title="Pendentes" />
            {pendingList.length === 0 ? (
              <Text variant="caption" color="textMuted">
                Nenhum item pendente.
              </Text>
            ) : (
              pendingList.map((item) => (
                <Card key={String(item.id)} padding="md" style={styles.card}>
                  <View style={styles.row}>
                    <SyncStatusIcon status={item.status} />
                    <View style={styles.flex}>
                      <Text variant="bodyBold" color="textPrimary">
                        {ACTION_LABELS[item.action_type] ?? item.action_type}
                      </Text>
                      <Text variant="caption" color="textMuted">
                        {relativeTimePtBr(item.created_at)}
                      </Text>
                    </View>
                  </View>
                </Card>
              ))
            )}

            <View style={styles.sectionGap} />
            <SectionHeader title="Falharam" />
            {failedList.length === 0 ? (
              <Text variant="caption" color="textMuted">
                Nenhuma falha.
              </Text>
            ) : (
              failedList.map((item) => (
                <View key={`f-${item.id}`} style={styles.cardWrap}>
                  <Card padding="md" style={styles.cardFailed}>
                    <View style={styles.row}>
                      <SyncStatusIcon status="failed" />
                      <View style={styles.flex}>
                        <Text variant="bodyBold" color="textPrimary">
                          {ACTION_LABELS[item.action_type] ?? item.action_type}
                        </Text>
                        <Text variant="caption" color="textMuted">
                          {relativeTimePtBr(item.created_at)}
                        </Text>
                        {item.last_error ? (
                          <Text variant="caption" color="danger" numberOfLines={4} style={styles.err}>
                            {item.last_error}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <View style={styles.actions}>
                      <Button variant="secondary" onPress={() => handleRetry(item)} style={styles.btn}>
                        Tentar novamente
                      </Button>
                      <Button
                        variant="ghost"
                        ghostDanger
                        onPress={() => handleDiscard(item)}
                        style={styles.btn}
                      >
                        Descartar
                      </Button>
                    </View>
                  </Card>
                </View>
              ))
            )}

            <View style={styles.sectionGap} />
            <SectionHeader title="Sincronizadas recentes" />
            {syncedRecent.length === 0 ? (
              <Text variant="caption" color="textMuted">
                Nenhuma sincronizada recente.
              </Text>
            ) : (
              syncedRecent.map((item) => (
                <Card key={`s-${item.id}`} padding="sm" style={styles.card}>
                  <View style={styles.row}>
                    <SyncStatusIcon status="synced" />
                    <View style={styles.flex}>
                      <Text variant="body" color="textPrimary">
                        {ACTION_LABELS[item.action_type] ?? item.action_type}
                      </Text>
                      <Text variant="caption" color="textMuted">
                        {item.synced_at ? relativeTimePtBr(item.synced_at) : '—'}
                      </Text>
                    </View>
                  </View>
                </Card>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  pad: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.huge,
  },
  scroll: {
    paddingBottom: spacing.huge,
  },
  sub: {
    marginTop: spacing.sm,
  },
  sectionGap: {
    height: spacing.lg,
  },
  card: {
    marginBottom: spacing.sm,
  },
  cardWrap: {
    marginBottom: spacing.sm,
  },
  cardFailed: {
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  flex: {
    flex: 1,
  },
  err: {
    marginTop: spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    flexWrap: 'wrap',
  },
  btn: {
    flex: 1,
    minWidth: 120,
  },
});
