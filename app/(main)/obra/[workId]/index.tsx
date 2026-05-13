'use client';

import { useCallback } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { TabView, TabBar, type Route, type SceneRendererProps } from 'react-native-tab-view';
import { useLocalSearchParams } from 'expo-router';

import { colors } from '@/design-system/tokens/colors';
import { HeroObra } from '@/components/obra/HeroObra';
import { ObraTabProvider, useObraTabs } from '@/components/obra/ObraTabContext';
import { DashboardTabContent } from '@/components/obra/screens/DashboardTabContent';
import { useSessionStore } from '@/stores/session.store';

import AlertasTab from './alertas';
import ChecklistsTab from './checklists';
import DiarioTab from './diario';
import EquipeTab from './equipe';
import MarcosTab from './marcos';
import PostesTab from './postes';

const ROUTES: Route[] = [
  { key: 'dashboard', title: 'Dashboard' },
  { key: 'diario', title: 'Diário' },
  { key: 'marcos', title: 'Marcos' },
  { key: 'postes', title: 'Postes' },
  { key: 'checklists', title: 'Checklists' },
  { key: 'alertas', title: 'Alertas' },
  { key: 'equipe', title: 'Equipe' },
];

function ObraTabsBody({ workId }: { workId: string }) {
  const layout = useWindowDimensions();
  const { tabIndex, setTabIndex } = useObraTabs();

  const renderScene = useCallback(
    ({ route }: SceneRendererProps & { route: Route }) => {
      switch (route.key) {
        case 'dashboard':
          return <DashboardTabContent workId={workId} />;
        case 'diario':
          return <DiarioTab />;
        case 'marcos':
          return <MarcosTab />;
        case 'postes':
          return <PostesTab />;
        case 'checklists':
          return <ChecklistsTab />;
        case 'alertas':
          return <AlertasTab />;
        case 'equipe':
          return <EquipeTab />;
        default:
          return <View />;
      }
    },
    [workId],
  );

  return (
    <TabView
      navigationState={{ index: tabIndex, routes: ROUTES }}
      renderScene={renderScene}
      onIndexChange={setTabIndex}
      initialLayout={{ width: layout.width }}
      renderTabBar={(props) => (
        <TabBar
          {...props}
          scrollEnabled
          tabStyle={styles.tabStyle}
          indicatorStyle={styles.indicator}
          style={styles.tabBar}
          activeColor={colors.primary}
          inactiveColor={colors.textSecondary}
        />
      )}
    />
  );
}

export default function ObraHubScreen() {
  const { workId } = useLocalSearchParams<{ workId: string }>();
  const id = typeof workId === 'string' ? workId : '';
  const userId = useSessionStore((s) => s.user?.id ?? '');

  return (
    <ObraTabProvider>
      <View style={styles.root}>
        <HeroObra workId={id} userId={userId} />
        <View style={styles.tabs}>
          <ObraTabsBody workId={id} />
        </View>
      </View>
    </ObraTabProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceMuted },
  tabs: { flex: 1 },
  tabBar: { backgroundColor: colors.surface },
  tabStyle: { width: 'auto', minHeight: 48 },
  indicator: { backgroundColor: colors.primaryAccent, height: 3 },
});
