'use client';

import { ChevronLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/design-system/primitives/Text';
import { colors } from '@/design-system/tokens/colors';
import { spacing } from '@/design-system/tokens/spacing';

type Props = {
  title: string;
  subtitle?: string;
  /** Acao a direita (sino, busca, menu). */
  right?: React.ReactNode;
  /** Conteudo colado no rodape do cabecalho, sem borda no meio (chips, passos). */
  footer?: React.ReactNode;
};

/**
 * Cabecalho branco sobre o creme da tela.
 *
 * Sem degrade e sem barra escura: a separacao vem de contraste de superficie
 * (surface sobre surfaceMuted) mais uma borda de 1 px.
 */
export function ObraHeader({ title, subtitle, right, footer }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [styles.back, { opacity: pressed ? 0.5 : 1 }]}
        >
          <ChevronLeft size={26} color={colors.textPrimary} strokeWidth={2} />
        </Pressable>

        <View style={styles.titles}>
          <Text variant="heading2" numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text variant="caption" color="textSecondary" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {right}
      </View>

      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  back: { minWidth: 30, minHeight: 44, justifyContent: 'center' },
  titles: { flex: 1, gap: 2 },
});
