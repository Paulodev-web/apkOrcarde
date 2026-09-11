'use client';

import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronRight, MapPin, Wrench } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { ObraHeader } from '@/components/obra/ObraHeader';
import { EmptyState } from '@/design-system/composed/EmptyState';
import { LoadingState } from '@/design-system/composed/LoadingState';
import { Text } from '@/design-system/primitives/Text';
import { TextInput } from '@/design-system/primitives/TextInput';
import { colors } from '@/design-system/tokens/colors';
import { radius } from '@/design-system/tokens/radius';
import { spacing } from '@/design-system/tokens/spacing';
import { supabase } from '@/lib/supabase/client';

type Poste = {
  id: string;
  numbering: string;
  poleType: string | null;
  installedAt: string;
};

/**
 * Equipamento so pode ser montado em poste que ja existe em pe. Por isso o
 * fluxo comeca escolhendo entre os postes JA LEVANTADOS — nao entre os
 * planejados. E a mesma regra do canteiro.
 */
async function fetchPostesInstalados(workId: string): Promise<Poste[]> {
  const { data, error } = await supabase
    .from('work_pole_installations')
    .select('id, numbering, pole_type, installed_at')
    .eq('work_id', workId)
    .eq('status', 'installed')
    .order('installed_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map((p) => ({
    id: p.id as string,
    numbering: (p.numbering as string | null) ?? 'sem numeração',
    poleType: p.pole_type as string | null,
    installedAt: p.installed_at as string,
  }));
}

export default function EquipamentoScreen() {
  const { workId } = useLocalSearchParams<{ workId: string }>();
  const id = typeof workId === 'string' ? workId : '';
  const router = useRouter();
  const [busca, setBusca] = useState('');

  const query = useQuery({
    queryKey: ['postesInstalados', id],
    queryFn: () => fetchPostesInstalados(id),
    enabled: id.length > 0,
  });

  const postes = useMemo(() => {
    const all = query.data ?? [];
    const termo = busca.trim().toLowerCase();
    if (!termo) return all;
    return all.filter((p) => p.numbering.toLowerCase().includes(termo));
  }, [query.data, busca]);

  return (
    <View style={styles.root}>
      <ObraHeader title="Equipamento" subtitle="Em qual poste?" />

      {query.isLoading ? (
        <LoadingState />
      ) : (query.data ?? []).length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="Nenhum poste levantado"
          description="Equipamento se monta em poste que já está em pé. Registre o poste primeiro."
          cta={{ label: 'Registrar poste', onPress: () => router.replace(`/(main)/obra/${id}/postes` as never) }}
        />
      ) : (
        <FlatList
          data={postes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.search}>
              <TextInput
                value={busca}
                onChangeText={setBusca}
                placeholder="Buscar poste…"
                autoCapitalize="characters"
              />
              <Text variant="label" color="textMuted">
                {`POSTES LEVANTADOS · ${(query.data ?? []).length}`}
              </Text>
            </View>
          }
          ListEmptyComponent={
            <Text variant="body" color="textSecondary" style={styles.semResultado}>
              Nenhum poste com esse número.
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: '/(main)/obra/[workId]/equipamento-poste',
                  params: { workId: id, installationId: item.id, numbering: item.numbering },
                } as never)
              }
              style={({ pressed }) => [styles.card, { opacity: pressed ? 0.7 : 1 }]}
            >
              <View style={styles.cardIcon}>
                <MapPin size={20} color={colors.primary} strokeWidth={1.9} />
              </View>
              <View style={styles.cardLabels}>
                <Text variant="bodyLargeBold" numberOfLines={1}>{item.numbering}</Text>
                <Text variant="caption" color="textSecondary" numberOfLines={1}>
                  {item.poleType ?? 'tipo não informado'}
                </Text>
              </View>
              <ChevronRight size={20} color={colors.textDisabled} strokeWidth={2} />
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceMuted },
  list: { padding: spacing.xl, paddingBottom: 120, gap: spacing.md },
  search: { gap: spacing.lg, marginBottom: spacing.xs },
  semResultado: { paddingVertical: spacing.xl },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 68,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLabels: { flex: 1, gap: 2 },
});
