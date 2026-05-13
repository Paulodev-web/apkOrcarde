import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, gradients } from '@/design-system/tokens/colors';

import { Text } from './Text';

type Size = 'sm' | 'md' | 'lg' | 'xl';

type Props = {
  name: string;
  size?: Size;
  gradient?: boolean;
};

const DIM: Record<Size, number> = { sm: 32, md: 40, lg: 56, xl: 80 };

function initials(full: string): string {
  const p = full.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return '?';
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

export function Avatar({ name, size = 'md', gradient = false }: Props) {
  const d = DIM[size];
  const ini = initials(name);

  if (gradient) {
    return (
      <LinearGradient
        colors={[...gradients.brand]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.circle, { width: d, height: d, borderRadius: d / 2 }]}
      >
        <Text variant="bodyBold" color="textInverse">
          {ini}
        </Text>
      </LinearGradient>
    );
  }

  return (
    <View
      style={[
        styles.circle,
        { width: d, height: d, borderRadius: d / 2, backgroundColor: colors.neutralBg },
      ]}
    >
      <Text variant="bodyBold" color="primary">
        {ini}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
