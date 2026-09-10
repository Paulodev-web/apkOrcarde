'use client';

import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';
import { Users } from 'lucide-react-native';

import { ObraHeader } from '@/components/obra/ObraHeader';
import { Avatar } from '@/design-system/primitives/Avatar';
import { Text } from '@/design-system/primitives/Text';
import { EmptyState } from '@/design-system/composed/EmptyState';
import { LoadingState } from '@/design-system/composed/LoadingState';
import { colors } from '@/design-system/tokens/colors';
import { radius } from '@/design-system/tokens/radius';
import { spacing } from '@/design-system/tokens/spacing';
import { supabase } from '@/lib/supabase/client';

type Row = {
  id: string;
  name: string;
  role: string | null;
};

const TEAM_KEY = 'workTeamMembers';

async function fetchTeamRows(workId: string): Promise<Row[]> {
  const { data, error } = await supabase
    .from('work_team')
    .select('id, name, crew_members(id, name, role, is_active)')
    .eq('work_id', workId)
    .eq('is_active', true);

  if (error || !data) return [];

  const rows: Row[] = [];
  for (const team of data as {
    id: string;
    name: string;
    crew_members: { id: string; name: string; role: string | null; is_active: boolean }[];
  }[]) {
    if (!team.crew_members) continue;
    for (const m of team.crew_members) {
      if (!m.is_active) continue;
      rows.push({ id: m.id, name: m.name, role: m.role ?? 'Função não informada' });
    }
  }
  return rows;
}

/**
 * Equipe alocada na obra. Somente leitura — quem aloca e o engenheiro, no web.
 */
export default function EquipeScreen() {
  const { workId } = useLocalSearchParams<{ workId: string }>();
  const id = typeof workId === 'string' ? workId : '';

  const query = useQuery({
    queryKey: [TEAM_KEY, id],
    queryFn: () => fetchTeamRows(id),
    enabled: id.length > 0,
  });

  const rows = query.data ?? [];

  return (
    <View style={styles.root}>
      <ObraHeader
        title="Equipe"
        subtitle={rows.length > 0 ? `${rows.length} no canteiro` : undefined}
      />

      {query.isLoading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum membro alocado"
          description="O engenheiro responsável ainda não alocou equipe para esta obra."
        />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Avatar name={item.name} size="md" />
              <View style={styles.cardText}>
                <Text variant="bodyLargeBold" numberOfLines={1}>{item.name}</Text>
                <Text variant="caption" color="textSecondary" numberOfLines={1}>{item.role}</Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceMuted },
  list: { padding: spacing.xl, paddingBottom: 120, gap: spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 72,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },
  cardText: { flex: 1, gap: 2 },
});
