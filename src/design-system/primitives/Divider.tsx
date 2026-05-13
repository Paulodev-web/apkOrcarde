import { View } from 'react-native';

import { colors } from '@/design-system/tokens/colors';
import { spacing, type SpacingKey } from '@/design-system/tokens/spacing';

type Props = {
  verticalMargin?: SpacingKey;
};

export function Divider({ verticalMargin = 'sm' }: Props) {
  const m = spacing[verticalMargin];
  return (
    <View
      style={{
        height: 1,
        backgroundColor: colors.border,
        width: '100%',
        marginVertical: m,
      }}
    />
  );
}
