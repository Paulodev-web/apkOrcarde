'use client';

import { AlertTriangle, FileText, Flag, MapPin } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/design-system/primitives/Button';
import { BottomSheet } from '@/design-system/composed/BottomSheet';
import { spacing } from '@/design-system/tokens/spacing';
import { useObraTabs } from '@/components/obra/ObraTabContext';

type Props = {
  open: boolean;
  onClose: () => void;
  workId: string;
};

export function QuickActionsSheet({ open, onClose, workId }: Props) {
  const router = useRouter();
  const { jumpToTab } = useObraTabs();

  const closeThen = (fn: () => void) => {
    onClose();
    setTimeout(fn, 0);
  };

  return (
    <BottomSheet visible={open} onClose={onClose} title="Ações rápidas">
      <View style={styles.stack}>
        <Button
          variant="primary"
          icon={MapPin}
          onPress={() => closeThen(() => jumpToTab('postes'))}
        >
          Marcar poste
        </Button>
        <Button
          variant="primary"
          icon={FileText}
          onPress={() => closeThen(() => jumpToTab('diario'))}
        >
          Publicar diário
        </Button>
        <Button
          variant="primary"
          icon={AlertTriangle}
          onPress={() => closeThen(() => router.push(`/(main)/obra/${workId}/alertas/novo`))}
        >
          Abrir alerta
        </Button>
        <Button
          variant="primary"
          icon={Flag}
          onPress={() => closeThen(() => jumpToTab('marcos'))}
        >
          Reportar marco
        </Button>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
});
