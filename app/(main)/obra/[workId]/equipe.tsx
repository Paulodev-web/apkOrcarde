'use client';

import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';
import { Users } from 'lucide-react-native';

import { Text } from '@/design-system/primitives/Text';
import { colors } from '@/design-system/tokens/colors';
import { spacing } from '@/design-system/tokens/spacing';
import { Avatar } from '@/design-system/primitives/Avatar';
import { EmptyState } from '@/design-system/composed/EmptyState';
import { LoadingState } from '@/design-system/composed/LoadingState';
import { ScreenContainer } from '@/design-system/layouts/ScreenContainer';
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
  for (const team of data as Array<{
    id: string;
    name: string;
    crew_members: Array<{ id: string; name: string; role: string | null; is_active: boolean }>;
  }>) {
    if (!team.crew_members) continue;
    for (const m of team.crew_members) {
      if (!m.is_active) continue;
      rows.push({
        id: m.id,
        name: m.name,
        role: m.role ?? 'Função não informada',
      });
    }
  }
  return rows;
}

export default function EquipeScreen() {
  const { workId } = useLocalSearchParams<{ workId: string }>();
  const id = typeof workId === 'string' ? workId : '';

  const query = useQuery({
    queryKey: [TEAM_KEY, id],
    queryFn: () => fetchTeamRows(id),
    enabled: id.length > 0,
  });

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      {query.isLoading ? (
        <LoadingState />
      ) : (
        <ScreenContainer scrollable={false} padding="lg">
          {query.data?.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Nenhum membro alocado"
              description="O engenheiro responsável ainda não alocou equipe para esta obra."
            />
          ) : (
            <FlatList
              data={query.data ?? []}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              renderItem={({ item }) => (
                <View style={styles.card}>
                  <Avatar name={item.name} size="md" gradient />
                  <View style={styles.cardText}>
                    <Text variant="bodyBold" color="textPrimary">
                      {item.name}
                    </Text>
                    <Text variant="caption" color="textSecondary">
                      {item.role}
                    </Text>
                  </View>
                </View>
              )}
            />
          )}
        </ScreenContainer>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceMuted },
  list: { paddingBottom: spacing.huge },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cardText: { flex: 1 },
});
