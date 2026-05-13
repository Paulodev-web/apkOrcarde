'use client';

import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Pdf from 'react-native-pdf';
import { FileQuestion } from 'lucide-react-native';

import { Text } from '@/design-system/primitives/Text';
import { colors } from '@/design-system/tokens/colors';
import { spacing } from '@/design-system/tokens/spacing';
import { EmptyState } from '@/design-system/composed/EmptyState';
import { ErrorState } from '@/design-system/composed/ErrorState';
import { LoadingState } from '@/design-system/composed/LoadingState';
import { ScreenHeader } from '@/design-system/layouts/ScreenHeader';
import { ScreenContainer } from '@/design-system/layouts/ScreenContainer';
import { getSignedUrl } from '@/lib/supabase/storage';
import { supabase } from '@/lib/supabase/client';

async function fetchPdfPath(workId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('work_project_snapshot')
    .select('pdf_storage_path')
    .eq('work_id', workId)
    .maybeSingle();
  if (error || !data?.pdf_storage_path) return null;
  return data.pdf_storage_path as string;
}

export default function PostesScreen() {
  const { workId } = useLocalSearchParams<{ workId: string }>();
  const id = typeof workId === 'string' ? workId : '';
  const [pdfUri, setPdfUri] = useState<string | null>(null);
  const [pdfErr, setPdfErr] = useState<string | null>(null);

  const pathQuery = useQuery({
    queryKey: ['projectSnapshot', 'pdfPath', id],
    queryFn: () => fetchPdfPath(id),
    enabled: id.length > 0,
  });

  useEffect(() => {
    const path = pathQuery.data;
    if (!path) {
      setPdfUri(null);
      return;
    }
    let cancelled = false;
    setPdfErr(null);
    void (async () => {
      try {
        const url = await getSignedUrl(path);
        if (!cancelled) setPdfUri(url);
      } catch (e) {
        if (!cancelled) setPdfErr(e instanceof Error ? e.message : 'Falha ao carregar PDF');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathQuery.data]);

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenContainer scrollable={false} padding="md">
        <ScreenHeader title="Postes" subtitle="Planta e marcações" />
        {pathQuery.isLoading ? (
          <LoadingState label="Carregando planta..." />
        ) : pdfErr ? (
          <ErrorState title="PDF indisponível" description={pdfErr} onRetry={() => void pathQuery.refetch()} />
        ) : !pdfUri ? (
          <EmptyState
            icon={FileQuestion}
            title="Planta não disponível"
            description="O PDF do projeto ainda não foi enviado para esta obra."
          />
        ) : (
          <View style={styles.pdfBox}>
            <Pdf
              source={{ uri: pdfUri, cache: true }}
              style={styles.pdf}
              trustAllCerts={false}
              onError={(e) => setPdfErr(typeof e === 'string' ? e : 'Erro ao renderizar PDF')}
            />
            <Text variant="caption" color="textMuted" style={styles.hint}>
              Modo marcação e detalhes de postes serão refinados na próxima iteração. PDF preservado para leitura.
            </Text>
          </View>
        )}
      </ScreenContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceMuted },
  pdfBox: { flex: 1, marginTop: spacing.md },
  pdf: { flex: 1, width: '100%', backgroundColor: colors.surface },
  hint: { marginTop: spacing.sm },
});
