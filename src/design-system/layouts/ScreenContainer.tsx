import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/design-system/tokens/colors';
import { spacing, type SpacingKey } from '@/design-system/tokens/spacing';

type Props = {
  children: ReactNode;
  scrollable?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  padding?: SpacingKey;
  background?: 'surface' | 'muted';
  /** When false, children manage their own scroll (e.g. FlatList). */
  noPadding?: boolean;
};

export function ScreenContainer({
  children,
  scrollable = false,
  refreshing = false,
  onRefresh,
  padding = 'lg',
  background = 'muted',
  noPadding = false,
}: Props) {
  const bg = background === 'muted' ? colors.surfaceMuted : colors.surface;
  const pad = noPadding ? 0 : spacing[padding];

  if (scrollable) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: bg }} edges={['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={{
            padding: pad,
            paddingBottom: spacing.huge,
            flexGrow: 1,
          }}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
              />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }} edges={['top', 'left', 'right']}>
      <View style={{ flex: 1, padding: pad }}>{children}</View>
    </SafeAreaView>
  );
}
