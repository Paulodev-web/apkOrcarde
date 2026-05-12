import { useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { logoutWithGuard } from '@/lib/auth/logout';

export default function WorkLayout() {
  const queryClient = useQueryClient();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#0a3a82' },
        headerTintColor: '#ffffff',
        headerTitleStyle: { fontWeight: '700' },
        headerBackTitle: 'Voltar',
        headerRight: () => (
          <Pressable
            onPress={() => logoutWithGuard(queryClient)}
            style={({ pressed }) => [styles.btn, pressed ? styles.btnPressed : null]}
            accessibilityRole="button"
            accessibilityLabel="Sair"
            hitSlop={12}
          >
            <Text style={styles.btnText}>Sair</Text>
          </Pressable>
        ),
      }}
    />
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPressed: {
    opacity: 0.6,
  },
  btnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
