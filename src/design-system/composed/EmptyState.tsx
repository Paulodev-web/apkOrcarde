import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/design-system/primitives/Button';
import { Text } from '@/design-system/primitives/Text';
import { colors } from '@/design-system/tokens/colors';
import { spacing } from '@/design-system/tokens/spacing';

type Props = {
  icon: LucideIcon;
  title: string;
  description?: string;
  cta?: { label: string; onPress: () => void };
};

export function EmptyState({ icon: Icon, title, description, cta }: Props) {
  return (
    <View style={styles.root}>
      <Icon size={64} color={colors.textMuted} strokeWidth={2} />
      <Text variant="heading3" color="textPrimary" style={styles.title}>
        {title}
      </Text>
      {description ? (
        <Text variant="body" color="textSecondary" style={styles.desc}>
          {description}
        </Text>
      ) : null}
      {cta ? (
        <Button variant="primary" onPress={cta.onPress} style={styles.cta}>
          {cta.label}
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxxl,
  },
  title: {
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  desc: {
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  cta: {
    marginTop: spacing.xl,
    alignSelf: 'stretch',
  },
});
