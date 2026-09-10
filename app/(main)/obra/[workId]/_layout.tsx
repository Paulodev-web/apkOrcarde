'use client';

import { Tabs, useLocalSearchParams, useSegments } from 'expo-router';
import { LayoutGrid, MessageCircle, Plus, Rows3, Users } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { FieldTabBar, type TabSpec } from '@/components/navigation/FieldTabBar';
import { RegistrarSheet } from '@/components/obra/RegistrarSheet';
import { FAB } from '@/design-system/composed/FAB';
import { colors } from '@/design-system/tokens/colors';

/**
 * Dentro da obra: tres destinos de consulta e uma acao.
 *
 * Substitui as sete abas horizontais que existiam aqui. Marcos, Postes e
 * Checklists deixaram de ser lugares para onde se navega — viram estado na
 * tela da obra e entrada na folha de Registrar. O gerente pensa "o que eu fiz
 * hoje", nao "qual entidade", entao Registros e uma linha do tempo unica.
 */
export default function WorkLayout() {
  const { workId } = useLocalSearchParams<{ workId: string }>();
  const id = typeof workId === 'string' ? workId : '';
  const [registrarOpen, setRegistrarOpen] = useState(false);

  // O FAB pertence aos destinos de consulta, nao aos fluxos de captura: numa
  // tela de registro ele pousa em cima do botao de salvar e nao serve para
  // nada — quem esta ali ja esta registrando. Na Conversa idem, sobre o campo
  // de mensagem. Por isso a lista e do que MOSTRA, nao do que esconde.
  const segments = useSegments();
  const atual = segments[segments.length - 1] ?? '';
  const showFab = atual === '[workId]' || atual === 'registros' || atual === 'equipe';

  const tabs: TabSpec[] = [
    { name: 'index', label: 'Obra', icon: LayoutGrid },
    { name: 'registros', label: 'Registros', icon: Rows3 },
    { name: 'chat', label: 'Conversa', icon: MessageCircle },
    { name: 'equipe', label: 'Equipe', icon: Users },
  ];

  return (
    <View style={styles.root}>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => <FieldTabBar {...props} tabs={tabs} centerGap />}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="registros" />
        <Tabs.Screen name="chat" />
        <Tabs.Screen name="equipe" />

        {/* Fluxos de registro: alcancados pela folha do +, nunca pela barra. */}
        <Tabs.Screen name="postes" options={{ href: null }} />
        <Tabs.Screen name="equipamento" options={{ href: null }} />
        <Tabs.Screen name="equipamento-poste" options={{ href: null }} />
        <Tabs.Screen name="rede" options={{ href: null }} />
        <Tabs.Screen name="rede-trecho" options={{ href: null }} />
        <Tabs.Screen name="marcos" options={{ href: null }} />
        <Tabs.Screen name="diario/index" options={{ href: null }} />
        <Tabs.Screen name="diario/[dailyLogId]" options={{ href: null }} />
        <Tabs.Screen name="checklists/index" options={{ href: null }} />
        <Tabs.Screen name="checklists/[checklistId]" options={{ href: null }} />
        <Tabs.Screen name="alertas/index" options={{ href: null }} />
        <Tabs.Screen name="alertas/novo" options={{ href: null }} />
        <Tabs.Screen name="alertas/[alertId]" options={{ href: null }} />
      </Tabs>

      {showFab ? (
        <FAB
          icon={Plus}
          position="bottom-center"
          bottom={62}
          accessibilityLabel="Registrar"
          onPress={() => setRegistrarOpen(true)}
        />
      ) : null}

      <RegistrarSheet open={registrarOpen} onClose={() => setRegistrarOpen(false)} workId={id} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceMuted },
});
