import { AlertCircle } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/design-system/primitives/Button';
import { Text } from '@/design-system/primitives/Text';
import { colors } from '@/design-system/tokens/colors';
import { spacing } from '@/design-system/tokens/spacing';

type Props = {
  title: string;
  description?: string;
  onRetry?: () => void;
};

export function ErrorState({ title, description, onRetry }: Props) {
  return (
    <View style={styles.root}>
      <AlertCircle size={64} color={colors.danger} strokeWidth={2} />
      <Text variant="heading3" color="danger" style={styles.title}>
        {title}
      </Text>
      {description ? (
        <Text variant="body" color="textSecondary" style={styles.desc}>
          {description}
        </Text>
      ) : null}
      {onRetry ? (
        <Button variant="secondary" onPress={onRetry} style={styles.cta}>
          Tentar novamente
        </Button>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxxl,
  },
  title: {
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  desc: {
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  cta: {
    marginTop: spacing.xl,
    alignSelf: 'stretch',
  },
});
