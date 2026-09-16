'use client';

import { useQuery } from '@tanstack/react-query';
import {  } from 'expo-router';

import { useWorkId } from '@/hooks/useWorkId';
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

/**
 * A query pedia colunas que a tabela nunca teve: `work_team.name`,
 * `work_team.is_active` e `crew_members.name`. O PostgREST respondia 400
 * ("column crew_members_1.name does not exist") e a aba Equipe ficava em erro
 * permanente. Os nomes reais sao `crew_members.full_name` e, para "ainda no
 * canteiro", `work_team.deallocated_at IS NULL` — nao existe flag is_active
 * na alocacao, a saida e registrada por data.
 *
 * `crew_members` tambem e embed many-to-one (work_team.crew_member_id aponta
 * para crew_members.id), entao vem como objeto e nao como lista; o codigo
 * antigo iterava sobre ele.
 */
async function fetchTeamRows(workId: string): Promise<Row[]> {
  const { data, error } = await supabase
    .from('work_team')
    .select('id, role_in_work, crew_members(id, full_name, role, is_active)')
    .eq('work_id', workId)
    .is('deallocated_at', null);

  // Falha de leitura não é "obra sem equipe". Lançando, o React Query mantém o
  // último resultado bom na tela, marca `isError` e tenta de novo sozinho; se
  // engolisse, a tela afirmaria com confiança que ninguém está alocado.
  if (error) throw new Error(error.message);
  if (!data) return [];

  const rows: Row[] = [];
  for (const team of data as unknown as {
    id: string;
    role_in_work: string | null;
    crew_members: {
      id: string;
      full_name: string;
      role: string | null;
      is_active: boolean;
    } | null;
  }[]) {
    const m = team.crew_members;
    if (!m || !m.is_active) continue;
    rows.push({
      id: m.id,
      name: m.full_name,
      role: team.role_in_work ?? m.role ?? 'Função não informada',
    });
  }
  return rows;
}

/**
 * Equipe alocada na obra. Somente leitura — quem aloca e o engenheiro, no web.
 */
export default function EquipeScreen() {
  const workId = useWorkId();
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
