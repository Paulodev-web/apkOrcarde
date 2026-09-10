import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/design-system/primitives/Text';
import { colors } from '@/design-system/tokens/colors';
import { spacing } from '@/design-system/tokens/spacing';

export type TabSpec = {
  /** Nome da rota, igual ao arquivo. */
  name: string;
  label: string;
  icon: LucideIcon;
  /** Ponto vermelho no canto do icone. */
  badge?: boolean;
};

type Props = BottomTabBarProps & {
  tabs: TabSpec[];
  /** Abre um vao no meio para o FAB pousar. */
  centerGap?: boolean;
};

/**
 * Trilho de navegacao CLARO, nao escuro.
 *
 * Regra herdada do web: no tema claro o app e claro inteiro, trilho incluido.
 * A separacao vem de contraste de superficie + borda (fundo neutral-50, trilho
 * neutral-100, cartoes brancos por cima), nunca de inversao de luminosidade.
 */
export function FieldTabBar({ state, navigation, tabs, centerGap = false }: Props) {
  const insets = useSafeAreaInsets();
  const half = Math.ceil(tabs.length / 2);

  const renderTab = (tab: TabSpec) => {
    const routeIndex = state.routes.findIndex((r) => r.name === tab.name);
    const focused = routeIndex >= 0 && state.index === routeIndex;
    const Icon = tab.icon;
    const tint = focused ? colors.accentDark : colors.textSecondary;

    return (
      <Pressable
        key={tab.name}
        accessibilityRole="button"
        accessibilityState={focused ? { selected: true } : {}}
        accessibilityLabel={tab.label}
        onPress={() => {
          const event = navigation.emit({
            type: 'tabPress',
            target: state.routes[routeIndex]?.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(tab.name);
          }
        }}
        style={({ pressed }) => [styles.item, { opacity: pressed ? 0.6 : 1 }]}
      >
        <View>
          <Icon size={24} color={tint} strokeWidth={focused ? 2.1 : 1.8} />
          {tab.badge ? <View style={styles.dot} /> : null}
        </View>
        <Text
          variant={focused ? 'captionBold' : 'caption'}
          style={{ fontSize: 12, lineHeight: 15, color: tint }}
        >
          {tab.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
      {centerGap ? (
        <>
          {tabs.slice(0, half).map(renderTab)}
          <View style={styles.gap} />
          {tabs.slice(half).map(renderTab)}
        </>
      ) : (
        tabs.map(renderTab)
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: colors.surfaceSunken,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
    paddingVertical: spacing.xs,
    minHeight: 48,
    justifyContent: 'center',
  },
  gap: { width: 76 },
  dot: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.surfaceSunken,
  },
});
