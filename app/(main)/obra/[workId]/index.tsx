import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { supabase } from '@/lib/supabase/client';
import type { Work, WorkStatus } from '@/types';
import { relativeTimePtBr } from '@/utils/relativeTime';

async function fetchWork(workId: string): Promise<Work> {
  const { data, error } = await supabase.from('works').select('*').eq('id', workId).single();
  if (error) throw error;
  if (!data) throw new Error('Obra nao encontrada');
  return data as Work;
}

export default function WorkDetailScreen() {
  const params = useLocalSearchParams<{ workId: string }>();
  const workId = typeof params.workId === 'string' ? params.workId : '';

  const query = useQuery({
    queryKey: ['works', 'detail', workId],
    queryFn: () => fetchWork(workId),
    enabled: workId.length > 0,
  });

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: query.data?.name ?? 'Obra' }} />

      {query.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0a3a82" />
        </View>
      ) : query.isError || !query.data ? (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Nao foi possivel carregar a obra</Text>
          <Text style={styles.errorText}>Verifique sua conexao e tente novamente.</Text>
          <Pressable
            onPress={() => void query.refetch()}
            style={({ pressed }) => [styles.retryBtn, pressed ? styles.retryBtnPressed : null]}
          >
            <Text style={styles.retryText}>Tentar de novo</Text>
          </Pressable>
        </View>
      ) : (
        <WorkBody work={query.data} />
      )}
    </View>
  );
}

function WorkBody({ work }: { work: Work }) {
  const router = useRouter();

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.headerCard}>
        <Text style={styles.workTitle}>{work.name}</Text>
        <Text style={styles.workClient}>{work.client_name}</Text>
        <View style={styles.rowSpace}>
          <StatusBadge status={work.status} />
          <Text style={styles.lastActivity}>{relativeTimePtBr(work.last_activity_at)}</Text>
        </View>
      </View>

      <Section title="Acoes">
        <Pressable
          onPress={() => router.push(`/(main)/obra/${work.id}/chat`)}
          style={({ pressed }) => [styles.actionBtn, pressed ? styles.actionBtnPressed : null]}
          accessibilityRole="button"
          accessibilityLabel="Abrir chat da obra"
        >
          <Text style={styles.actionBtnText}>Chat</Text>
          <Text style={styles.actionArrow}>{'>'}</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push(`/(main)/obra/${work.id}/postes`)}
          style={({ pressed }) => [styles.actionBtn, pressed ? styles.actionBtnPressed : null]}
          accessibilityRole="button"
          accessibilityLabel="Abrir postes da obra"
        >
          <Text style={styles.actionBtnText}>Postes</Text>
          <Text style={styles.actionArrow}>{'>'}</Text>
        </Pressable>
      </Section>

      {work.address ? (
        <Section title="Endereco">
          <Text style={styles.bodyText}>{work.address}</Text>
        </Section>
      ) : null}

      <Section title="Datas">
        <DateRow label="Inicio" value={work.started_at} />
        <DateRow label="Previsao de termino" value={work.expected_end_at} />
        {work.completed_at ? <DateRow label="Concluida em" value={work.completed_at} /> : null}
      </Section>

      {work.notes ? (
        <Section title="Notas">
          <Text style={styles.bodyText}>{work.notes}</Text>
        </Section>
      ) : null}

      <Section title="Em breve">
        <Text style={styles.placeholder}>
          Diario, marcos, checklists, alertas e equipe serao adicionados nos proximos blocos.
        </Text>
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function DateRow({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={styles.dateRow}>
      <Text style={styles.dateLabel}>{label}</Text>
      <Text style={styles.dateValue}>{formatDate(value)}</Text>
    </View>
  );
}

function formatDate(value: string | null): string {
  if (!value) return 'Nao informada';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Nao informada';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function StatusBadge({ status }: { status: WorkStatus }) {
  const palette = STATUS_COLORS[status];
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <Text style={[styles.badgeText, { color: palette.fg }]}>{STATUS_LABELS[status]}</Text>
    </View>
  );
}

const STATUS_LABELS: Record<WorkStatus, string> = {
  planned: 'Planejada',
  in_progress: 'Em andamento',
  paused: 'Pausada',
  completed: 'Concluida',
  cancelled: 'Cancelada',
};

const STATUS_COLORS: Record<WorkStatus, { bg: string; fg: string }> = {
  planned: { bg: '#e3effc', fg: '#0a3a82' },
  in_progress: { bg: '#dff6e1', fg: '#1a6b2c' },
  paused: { bg: '#fdf3d6', fg: '#7a5b00' },
  completed: { bg: '#dcdfe6', fg: '#3b4452' },
  cancelled: { bg: '#fdecea', fg: '#7a1f17' },
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f3f6fb',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 48,
  },
  headerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e3e8ef',
    marginBottom: 16,
  },
  workTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1c1f24',
  },
  workClient: {
    marginTop: 4,
    fontSize: 14,
    color: '#3b4452',
  },
  rowSpace: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lastActivity: {
    color: '#5a6473',
    fontSize: 13,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  section: {
    marginBottom: 16,
  },
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
  bodyText: {
    color: '#1c1f24',
    fontSize: 14,
    lineHeight: 20,
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  dateLabel: {
    color: '#5a6473',
    fontSize: 14,
  },
  dateValue: {
    color: '#1c1f24',
    fontSize: 14,
    fontWeight: '600',
  },
  placeholder: {
    color: '#5a6473',
    fontSize: 13,
    lineHeight: 18,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e3e8ef',
  },
  actionBtnPressed: {
    opacity: 0.6,
  },
  actionBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0a3a82',
  },
  actionArrow: {
    fontSize: 18,
    color: '#5a6473',
    fontWeight: '600',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1c1f24',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    color: '#5a6473',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryBtn: {
    minHeight: 48,
    paddingHorizontal: 24,
    borderRadius: 10,
    backgroundColor: '#0a3a82',
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryBtnPressed: {
    backgroundColor: '#072a60',
  },
  retryText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
});
