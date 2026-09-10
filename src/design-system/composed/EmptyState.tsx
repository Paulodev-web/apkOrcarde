import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/design-system/primitives/Button';
import { radius } from '@/design-system/tokens/radius';
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
      <View style={styles.iconBox}>
        <Icon size={30} color={colors.textMuted} strokeWidth={1.8} />
      </View>
      <Text variant="heading3" color="textPrimary" style={styles.title}>
        {title}
      </Text>
      {description ? (
        <Text variant="body" color="textSecondary" style={styles.desc}>
          {description}
        </Text>
      ) : null}
      {cta ? (
        <Button variant="secondary" block onPress={cta.onPress} style={styles.cta}>
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
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
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
