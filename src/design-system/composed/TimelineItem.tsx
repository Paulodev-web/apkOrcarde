import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/design-system/primitives/Text';
import { colors, type ColorKey } from '@/design-system/tokens/colors';
import { spacing } from '@/design-system/tokens/spacing';

type Props = {
  icon: LucideIcon;
  iconColor?: ColorKey;
  title: string;
  subtitle?: string;
  timestamp: string;
  isLast?: boolean;
  children?: React.ReactNode;
};

export function TimelineItem({
  icon: Icon,
  iconColor = 'primary',
  title,
  subtitle,
  timestamp,
  isLast = false,
  children,
}: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.leftCol}>
        <View style={[styles.iconCircle, { borderColor: colors[iconColor] }]}>
          <Icon size={18} color={colors[iconColor]} strokeWidth={2} />
        </View>
        {!isLast ? (
          <View
            style={{
              width: 2,
              height: spacing.xxl,
              backgroundColor: colors.border,
              marginTop: spacing.xs,
            }}
          />
        ) : null}
      </View>
      <View style={styles.content}>
        <Text variant="bodyBold" color="textPrimary">
          {title}
        </Text>
        {subtitle ? (
          <Text variant="body" color="textSecondary" style={styles.mt}>
            {subtitle}
          </Text>
        ) : null}
        <Text variant="caption" color="textMuted" style={styles.mt}>
          {timestamp}
        </Text>
        {children ? <View style={styles.children}>{children}</View> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  leftCol: {
    width: 40,
    alignItems: 'center',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  content: {
    flex: 1,
    paddingBottom: spacing.lg,
  },
  mt: {
    marginTop: spacing.xs,
  },
  children: {
    marginTop: spacing.sm,
  },
});
