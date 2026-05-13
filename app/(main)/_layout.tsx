import { Drawer } from 'expo-router/drawer';

import { DrawerContent } from '@/components/navigation/DrawerContent';

export default function MainLayout() {
  return (
    <Drawer
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerStyle: { width: '85%' },
      }}
    >
      <Drawer.Screen name="index" options={{ title: 'Obras' }} />
      <Drawer.Screen name="notificacoes" options={{ title: 'Notificações' }} />
      <Drawer.Screen name="fila" options={{ title: 'Fila' }} />
      <Drawer.Screen name="configuracoes" options={{ title: 'Configurações' }} />
      <Drawer.Screen name="sobre" options={{ title: 'Sobre' }} />
      <Drawer.Screen
        name="obra/[workId]"
        options={{ drawerItemStyle: { display: 'none' } }}
      />
    </Drawer>
  );
}
