import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/design-system/primitives/Text';
import { spacing } from '@/design-system/tokens/spacing';

type Props = {
  title: string;
  action?: { label: string; onPress: () => void };
};

export function SectionHeader({ title, action }: Props) {
  return (
    <View style={styles.row}>
      <Text variant="heading3" color="textPrimary" style={styles.title}>
        {title}
      </Text>
      {action ? (
        <Pressable
          accessibilityRole="button"
          onPress={action.onPress}
          style={({ pressed }) => [styles.actionBtn, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Text variant="bodyBold" color="primary">
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
    marginBottom: spacing.sm,
    minHeight: 48,
  },
  title: {
    flex: 1,
  },
  actionBtn: {
    minHeight: 48,
    paddingHorizontal: spacing.sm,
    justifyContent: 'center',
  },
});
