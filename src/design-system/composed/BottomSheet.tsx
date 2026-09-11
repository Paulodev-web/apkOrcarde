import { X } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/design-system/primitives/IconButton';
import { Text } from '@/design-system/primitives/Text';
import { colors } from '@/design-system/tokens/colors';
import { radius } from '@/design-system/tokens/radius';
import { shadows } from '@/design-system/tokens/shadows';
import { spacing } from '@/design-system/tokens/spacing';

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Altura maxima da folha, em fracao da tela. */
  maxHeightRatio?: number;
};

/**
 * Folha de baixo, em Modal nativo.
 *
 * Nao usa @gorhom/bottom-sheet: naquela combinacao (RN 0.83 em Fabric +
 * Reanimated 4) o `present()` roda mas a folha nao pinta, e o gerente fica
 * batendo num botao que nao responde. Aqui o Modal do proprio React Native
 * garante que a folha aparece; o que se perde e o arraste para fechar, que
 * nao e requisito — toque no fundo e no X fecham, e o botao voltar do Android
 * tambem (onRequestClose).
 */
export function BottomSheet({
  visible,
  onClose,
  title,
  children,
  maxHeightRatio = 0.85,
}: Props) {
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slide, {
      toValue: visible ? 1 : 0,
      duration: visible ? 220 : 160,
      useNativeDriver: true,
    }).start();
  }, [visible, slide]);

  const translateY = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [420, 0],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Pressable
          style={styles.backdrop}
          accessibilityRole="button"
          accessibilityLabel="Fechar"
          onPress={onClose}
        />

        <Animated.View
          style={[
            styles.sheet,
            shadows.lg,
            {
              maxHeight: `${Math.round(maxHeightRatio * 100)}%`,
              paddingBottom: Math.max(insets.bottom, spacing.xl),
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={styles.grip} />

          <View style={styles.header}>
            <Text variant="heading2" style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            <IconButton icon={X} onPress={onClose} accessibilityLabel="Fechar" variant="ghost" />
          </View>

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(24, 24, 22, 0.45)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingTop: spacing.md,
  },
  grip: {
    width: 40,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.borderStrong,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  title: { flex: 1 },
  body: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg },
});
