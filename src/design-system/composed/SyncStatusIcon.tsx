import { Check, Clock, Loader2, Upload, X } from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors } from '@/design-system/tokens/colors';
import type { OutboxStatus } from '@/types';

type Props = {
  status: OutboxStatus;
};

export function SyncStatusIcon({ status }: Props) {
  if (status === 'pending') {
    return <Clock size={22} color={colors.textMuted} strokeWidth={2} />;
  }
  if (status === 'uploading_media') {
    return (
      <View style={styles.box}>
        <Upload size={22} color={colors.info} strokeWidth={2} />
        <View style={styles.overlay}>
          <ActivityIndicator size="small" color={colors.info} />
        </View>
      </View>
    );
  }
  if (status === 'calling_rpc') {
    return (
      <View style={styles.box}>
        <Loader2 size={22} color={colors.info} strokeWidth={2} />
        <View style={styles.overlay}>
          <ActivityIndicator size="small" color={colors.info} />
        </View>
      </View>
    );
  }
  if (status === 'synced') {
    return <Check size={22} color={colors.success} strokeWidth={2} />;
  }
  return <X size={22} color={colors.danger} strokeWidth={2} />;
}

const styles = StyleSheet.create({
  box: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
