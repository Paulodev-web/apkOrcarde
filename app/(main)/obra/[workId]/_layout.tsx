import { Stack } from 'expo-router';

export default function WorkLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerBackTitle: 'Voltar',
        animation: 'default',
      }}
    />
  );
}
