import { StyleSheet, View } from 'react-native';

import { Text } from '@/design-system/primitives/Text';
import { colors } from '@/design-system/tokens/colors';
import { spacing } from '@/design-system/tokens/spacing';
import type { MilestoneStatus } from '@/types';

export type MarcosTimelineMilestone = {
  id: string;
  name: string;
  status: MilestoneStatus;
  order_index: number;
};

type Props = {
  milestones: MarcosTimelineMilestone[];
  variant?: 'compact' | 'detailed';
};

const DOT = 12;
const LINE = 2;

function dotStyle(status: MilestoneStatus): {
  backgroundColor?: string;
  borderColor: string;
  borderWidth: number;
} {
  switch (status) {
    case 'pending':
      return { borderColor: colors.border, borderWidth: 2, backgroundColor: colors.surface };
    case 'in_progress':
      return { borderColor: colors.border, borderWidth: 0, backgroundColor: colors.info };
    case 'awaiting_approval':
      return { borderColor: colors.border, borderWidth: 0, backgroundColor: colors.warning };
    case 'approved':
      return { borderColor: colors.border, borderWidth: 0, backgroundColor: colors.success };
    case 'rejected':
      return { borderColor: colors.border, borderWidth: 0, backgroundColor: colors.danger };
    default:
      return { borderColor: colors.border, borderWidth: 2, backgroundColor: colors.surface };
  }
}

export function MarcosTimeline({ milestones, variant = 'compact' }: Props) {
  const sorted = [...milestones].sort((a, b) => a.order_index - b.order_index);
  const slots: MarcosTimelineMilestone[] = [...sorted];
  while (slots.length < 6) {
    slots.push({
      id: `pad-${slots.length}`,
      name: '',
      status: 'pending',
      order_index: slots.length,
    });
  }
  const six = slots.slice(0, 6);

  return (
    <View style={styles.root}>
      <View style={styles.track}>
        <View style={styles.line} pointerEvents="none" />
        <View style={styles.dotsRow}>
          {six.map((m) => (
            <View key={m.id} style={styles.dotWrap}>
              <View style={[styles.dot, dotStyle(m.status)]} />
            </View>
          ))}
        </View>
      </View>
      {variant === 'detailed' ? (
        <View style={styles.labels}>
          {six.map((m) => (
            <View key={`${m.id}-lbl`} style={styles.labelCell}>
              <Text variant="caption" color="textMuted" numberOfLines={2}>
                {m.name || '—'}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    marginTop: spacing.xs,
  },
  track: {
    height: DOT + spacing.sm,
    justifyContent: 'center',
  },
  line: {
    position: 'absolute',
    left: '8%',
    right: '8%',
    top: DOT / 2 - LINE / 2,
    height: LINE,
    backgroundColor: colors.border,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: '4%',
  },
  dotWrap: {
    width: DOT,
    alignItems: 'center',
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    paddingHorizontal: 0,
  },
  labelCell: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 2,
  },
});
