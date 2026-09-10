'use client';

import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowRight, ChevronRight, Waves } from 'lucide-react-native';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { ObraHeader } from '@/components/obra/ObraHeader';
import { EmptyState } from '@/design-system/composed/EmptyState';
import { LoadingState } from '@/design-system/composed/LoadingState';
import { Text } from '@/design-system/primitives/Text';
import { colors } from '@/design-system/tokens/colors';
import { radius } from '@/design-system/tokens/radius';
import { spacing } from '@/design-system/tokens/spacing';
import { supabase } from '@/lib/supabase/client';

type Trecho = {
  id: string;
  origem: string;
  destino: string;
  categoria: string | null;
  metros: number | null;
  cabo: string | null;
};

/**
 * Trecho de rede vai de um poste a outro. O projeto ja diz quais ligacoes
 * existem (`work_project_connections`), entao o gerente escolhe de uma lista
 * do que foi projetado em vez de desenhar o trecho na mao.
 */
async function fetchTrechos(workId: string): Promise<Trecho[]> {
  const { data, error } = await supabase
    .from('work_project_connections')
    .select('id, metadata, from_post:work_project_posts!from_post_id(numbering), to_post:work_project_posts!to_post_id(numbering)')
    .eq('work_id', workId);

  if (error) throw error;

  const nomeDe = (rel: unknown): string => {
    const r = Array.isArray(rel) ? rel[0] : rel;
    const n = (r as { numbering?: string } | null)?.numbering;
    return n ?? '—';
  };

  return (data ?? []).map((c) => ({
    id: c.id as string,
    origem: nomeDe(c.from_post),
    destino: nomeDe(c.to_post),
    categoria: ((c.metadata as { category?: string } | null)?.category) ?? null,
    metros: ((c.metadata as { meters?: number } | null)?.meters) ?? null,
    cabo: ((c.metadata as { cable?: string } | null)?.cable) ?? null,
  }));
}

export default function RedeScreen() {
  const { workId } = useLocalSearchParams<{ workId: string }>();
  const id = typeof workId === 'string' ? workId : '';
  const router = useRouter();

  const query = useQuery({
    queryKey: ['trechosProjetados', id],
    queryFn: () => fetchTrechos(id),
    enabled: id.length > 0,
  });

  const trechos = query.data ?? [];

  return (
    <View style={styles.root}>
      <ObraHeader title="Rede" subtitle="Qual trecho você lançou?" />

      {query.isLoading ? (
        <LoadingState />
      ) : trechos.length === 0 ? (
        <EmptyState
          icon={Waves}
          title="Nenhum trecho no projeto"
          description="Esta obra ainda não tem o projeto importado, então não há trechos para lançar."
          cta={{ label: 'Voltar', onPress: () => router.back() }}
        />
      ) : (
        <FlatList
          data={trechos}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <Text variant="label" color="textMuted">
              {`TRECHOS DO PROJETO · ${trechos.length}`}
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Trecho de ${item.origem} até ${item.destino}`}
              onPress={() =>
                router.push({
                  pathname: '/(main)/obra/[workId]/rede-trecho',
                  params: {
                    workId: id,
                    connectionId: item.id,
                    origem: item.origem,
                    destino: item.destino,
                    categoria: item.categoria ?? 'BT',
                    metros: item.metros != null ? String(item.metros) : '',
                    cabo: item.cabo ?? '',
                  },
                } as never)
              }
              style={({ pressed }) => [styles.card, { opacity: pressed ? 0.7 : 1 }]}
            >
              <View style={styles.trecho}>
                <Text variant="bodyLargeBold">{item.origem}</Text>
                <ArrowRight size={18} color={colors.textMuted} strokeWidth={2} />
                <Text variant="bodyLargeBold">{item.destino}</Text>
              </View>
              <View style={styles.cardMeta}>
                <Text variant="caption" color="textSecondary">
                  {item.categoria ?? 'categoria no projeto'}
                </Text>
                <ChevronRight size={20} color={colors.textDisabled} strokeWidth={2} />
              </View>
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
  card: {
    gap: spacing.sm,
    minHeight: 76,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },
  trecho: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cardMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
