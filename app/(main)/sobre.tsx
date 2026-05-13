import { DrawerActions, useNavigation } from '@react-navigation/native';
import Constants from 'expo-constants';
import { Menu } from 'lucide-react-native';
import { Image, Linking, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/design-system/primitives/Button';
import { Text } from '@/design-system/primitives/Text';
import { ScreenContainer } from '@/design-system/layouts/ScreenContainer';
import { ScreenHeader } from '@/design-system/layouts/ScreenHeader';
import { spacing } from '@/design-system/tokens/spacing';

export default function SobreScreen() {
  const navigation = useNavigation();
  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <ScreenContainer scrollable={false} background="muted">
      <ScreenHeader
        title="Sobre"
        leftAction={{
          icon: Menu,
          onPress: () => navigation.dispatch(DrawerActions.openDrawer()),
          accessibilityLabel: 'Abrir menu',
        }}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Image
          source={require('../../assets/OnEngenharia.webp')}
          style={styles.logo}
          accessibilityIgnoresInvertColors
        />
        <View style={styles.gapXl} />
        <Text variant="heading2" color="textPrimary" style={styles.center}>
          OrçaRede
        </Text>
        <Text variant="body" color="textSecondary" style={styles.center}>
          ON Engenharia Elétrica
        </Text>
        <Text variant="caption" color="textMuted" style={styles.center}>
          Versão {version}
        </Text>
        <View style={styles.gapXxl} />
        <Text variant="bodyLarge" color="textSecondary" style={styles.desc}>
          Aplicativo de campo para gestão de obras de redes elétricas de distribuição.
        </Text>
        <View style={styles.gapXxl} />
        <Button
          variant="ghost"
          onPress={() => void Linking.openURL('https://example.com/termos')}
          style={styles.linkBtn}
        >
          Termos de uso
        </Button>
        <Button
          variant="ghost"
          onPress={() => void Linking.openURL('https://example.com/privacidade')}
          style={styles.linkBtn}
        >
          Política de privacidade
        </Button>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: {
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.huge,
    paddingTop: spacing.lg,
  },
  logo: {
    width: 200,
    height: 200,
  },
  gapXl: {
    height: spacing.xl,
  },
  gapXxl: {
    height: spacing.xxl,
  },
  center: {
    textAlign: 'center',
  },
  desc: {
    textAlign: 'center',
    lineHeight: 24,
  },
  linkBtn: {
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
});
