import type { LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import {
  KeyboardTypeOptions,
  Pressable,
  StyleSheet,
  TextInput as RNTextInput,
  View,
} from 'react-native';

import { colors } from '@/design-system/tokens/colors';
import { radius } from '@/design-system/tokens/radius';
import { spacing } from '@/design-system/tokens/spacing';

import { Text } from './Text';

type Props = {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
  helperText?: string;
  secureTextEntry?: boolean;
  multiline?: boolean;
  numberOfLines?: number;
  maxLength?: number;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  rightIcon?: LucideIcon;
  onRightIconPress?: () => void;
  onBlur?: () => void;
  editable?: boolean;
};

export function TextInput({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  helperText,
  secureTextEntry,
  multiline,
  numberOfLines,
  maxLength,
  keyboardType,
  autoCapitalize,
  rightIcon: RightIcon,
  onRightIconPress,
  onBlur,
  editable = true,
}: Props) {
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.danger : focused ? colors.primary : colors.border;

  return (
    <View style={styles.root}>
      {label ? (
        <Text variant="label" color="textSecondary" style={styles.label}>
          {label}
        </Text>
      ) : null}
      <View style={[styles.fieldRow, { borderColor }]}>
        <RNTextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={secureTextEntry}
          multiline={multiline}
          numberOfLines={numberOfLines}
          maxLength={maxLength}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            onBlur?.();
          }}
          editable={editable}
          style={[
            styles.input,
            multiline ? { minHeight: (numberOfLines ?? 4) * 20 } : { minHeight: 48 },
            RightIcon ? { paddingRight: 44 } : undefined,
          ]}
        />
        {RightIcon && onRightIconPress ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={secureTextEntry ? 'Mostrar ou ocultar senha' : 'Ação no campo'}
            onPress={onRightIconPress}
            style={styles.rightBtn}
          >
            <RightIcon size={22} color={colors.primary} strokeWidth={2} />
          </Pressable>
        ) : RightIcon ? (
          <View style={styles.rightBtn}>
            <RightIcon size={22} color={colors.textMuted} strokeWidth={2} />
          </View>
        ) : null}
      </View>
      {error ? (
        <Text variant="caption" color="danger" style={styles.hint}>
          {error}
        </Text>
      ) : helperText ? (
        <Text variant="caption" color="textMuted" style={styles.hint}>
          {helperText}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
  },
  label: {
    marginBottom: spacing.xs,
  },
  fieldRow: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: 14,
    color: colors.textPrimary,
  },
  rightBtn: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    marginTop: spacing.xs,
  },
});
