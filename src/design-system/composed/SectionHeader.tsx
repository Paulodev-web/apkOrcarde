import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/design-system/primitives/Text';
import { spacing } from '@/design-system/tokens/spacing';

type Props = {
  title: string;
  action?: { label: string; onPress: () => void };
};

/**
 * Cabecalho de secao: rotulo em caixa alta, nao titulo.
 *
 * Um heading por secao faz cada bloco competir com o titulo da tela. O rotulo
 * separa sem gritar — quem manda na hierarquia e o conteudo do cartao.
 */
export function SectionHeader({ title, action }: Props) {
  return (
    <View style={styles.row}>
      <Text variant="label" color="textMuted" style={styles.title}>
        {title.toUpperCase()}
      </Text>
      {action ? (
        <Pressable
          accessibilityRole="button"
          onPress={action.onPress}
          hitSlop={10}
          style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Text variant="captionBold" color="primary">
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md,
    minHeight: 24,
  },
  title: { flex: 1 },
  actionBtn: { minHeight: 32, justifyContent: 'center' },
});
