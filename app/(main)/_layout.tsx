import { Tabs } from 'expo-router';
import { Bell, Home, RefreshCw, User } from 'lucide-react-native';

import { FieldTabBar, type TabSpec } from '@/components/navigation/FieldTabBar';
import { useNotificationStore } from '@/stores/notification.store';
import { useOutboxCount } from '@/hooks/useOutboxCount';

/**
 * Fora da obra: quatro destinos fixos, sem gaveta lateral.
 *
 * A gaveta escondia justamente o que precisa estar sempre a um toque no
 * canteiro — a fila de envio e os avisos. Com a barra, o gerente ve o estado
 * (ponto vermelho) sem abrir nada.
 */
export default function MainLayout() {
  const unread = useNotificationStore((s) => s.unreadCount);
  const { pendingCount } = useOutboxCount();

  const tabs: TabSpec[] = [
    { name: 'index', label: 'Obras', icon: Home },
    { name: 'notificacoes', label: 'Avisos', icon: Bell, badge: unread > 0 },
    { name: 'fila', label: 'Fila', icon: RefreshCw, badge: pendingCount > 0 },
    { name: 'configuracoes', label: 'Perfil', icon: User },
  ];

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      // Dentro de uma obra quem manda e a barra da obra: duas barras
      // empilhadas comem 1/6 da tela e dao dois "onde estou" concorrentes.
      tabBar={(props) =>
        props.state.routes[props.state.index]?.name === 'obra/[workId]' ? null : (
          <FieldTabBar {...props} tabs={tabs} />
        )
      }
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="notificacoes" />
      <Tabs.Screen name="fila" />
      <Tabs.Screen name="configuracoes" />
      <Tabs.Screen name="sobre" options={{ href: null }} />
      <Tabs.Screen name="obra/[workId]" options={{ href: null }} />
    </Tabs>
  );
}
