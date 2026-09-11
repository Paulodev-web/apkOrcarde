import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Text } from '@/design-system/primitives/Text';
import { colors } from '@/design-system/tokens/colors';
import { spacing } from '@/design-system/tokens/spacing';
import { getPublicEnvConfig, missingPublicEnvMessage } from '@/lib/env';

import RootLayoutApp from './RootLayoutApp';

export default function RootLayout() {
  if (!getPublicEnvConfig()) {
    return (
      <SafeAreaProvider>
        <View style={styles.configError}>
          <Text variant="heading2" style={styles.configErrorTitle}>
            Configuracao do app
          </Text>
          <Text variant="body" color="textMuted">
            {missingPublicEnvMessage}
          </Text>
        </View>
      </SafeAreaProvider>
    );
  }

  return <RootLayoutApp />;
}

const styles = StyleSheet.create({
  configError: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.surface,
    gap: spacing.md,
  },
  configErrorTitle: {
    color: colors.danger,
  },
});
