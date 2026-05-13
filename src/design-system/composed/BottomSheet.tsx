import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { IconButton } from '@/design-system/primitives/IconButton';
import { Text } from '@/design-system/primitives/Text';
import { colors } from '@/design-system/tokens/colors';
import { spacing } from '@/design-system/tokens/spacing';

type Props = {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  snapPoints?: string[];
};

export function BottomSheet({
  visible,
  onClose,
  title,
  children,
  snapPoints,
}: Props) {
  const ref = useRef<BottomSheetModal>(null);
  const points = useMemo(() => snapPoints ?? ['50%', '90%'], [snapPoints]);

  useEffect(() => {
    if (visible) {
      ref.current?.present();
    } else {
      ref.current?.dismiss();
    }
  }, [visible]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.45}
      />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={points}
      enablePanDownToClose
      onDismiss={onClose}
      backdropComponent={renderBackdrop}
    >
      <View style={styles.header}>
        <Text variant="heading3" color="textPrimary" style={styles.title}>
          {title}
        </Text>
        <IconButton
          icon={X}
          onPress={onClose}
          accessibilityLabel="Fechar"
          variant="ghost"
        />
      </View>
      <BottomSheetScrollView contentContainerStyle={styles.body}>
        {children}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    flex: 1,
    marginRight: spacing.sm,
  },
  body: {
    padding: spacing.lg,
    paddingBottom: spacing.huge,
  },
});
