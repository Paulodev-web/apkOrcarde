import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Text } from '@/design-system/primitives/Text';
import { colors } from '@/design-system/tokens/colors';
import { spacing } from '@/design-system/tokens/spacing';

type Props = {
  label?: string;
};

export function LoadingState({ label }: Props) {
  return (
    <View style={styles.root}>
      <ActivityIndicator size="large" color={colors.primary} />
      {label ? (
        <Text variant="body" color="textSecondary" style={styles.label}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  label: {
    marginTop: spacing.md,
  },
});
