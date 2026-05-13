import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Divider } from '@/design-system/primitives/Divider';
import { Text } from '@/design-system/primitives/Text';
import { spacing } from '@/design-system/tokens/spacing';

type Props = {
  title?: string;
  description?: string;
  children: ReactNode;
};

export function FormSection({ title, description, children }: Props) {
  return (
    <View style={styles.section}>
      {title ? (
        <Text variant="heading3" color="textPrimary">
          {title}
        </Text>
      ) : null}
      {description ? (
        <Text variant="body" color="textSecondary" style={styles.desc}>
          {description}
        </Text>
      ) : null}
      {title || description ? <Divider verticalMargin="md" /> : null}
      <View style={styles.fields}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.xl,
  },
  desc: {
    marginTop: spacing.xs,
  },
  fields: {
    gap: spacing.md,
  },
});
