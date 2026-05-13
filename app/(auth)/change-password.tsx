import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { Button } from '@/design-system/primitives/Button';
import { Text } from '@/design-system/primitives/Text';
import { TextInput } from '@/design-system/primitives/TextInput';
import { FormSection } from '@/design-system/layouts/FormSection';
import { ScreenHeader } from '@/design-system/layouts/ScreenHeader';
import { colors } from '@/design-system/tokens/colors';
import { spacing } from '@/design-system/tokens/spacing';
import { changePassword } from '@/lib/auth/session';
import { captureBreadcrumb } from '@/lib/sentry';
import { useSessionStore } from '@/stores/session.store';

const schema = z
  .object({
    password: z.string().min(8, 'A senha precisa ter no minimo 8 caracteres'),
    confirm: z.string().min(8, 'A senha precisa ter no minimo 8 caracteres'),
  })
  .refine((data) => data.password === data.confirm, {
    message: 'As senhas nao coincidem',
    path: ['confirm'],
  });

type FormValues = z.infer<typeof schema>;

export default function ChangePasswordScreen() {
  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const setMustChangePassword = useSessionStore((s) => s.setMustChangePassword);
  const userEmail = useSessionStore((s) => s.user?.email ?? '');

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirm: '' },
  });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    setGlobalError(null);
    captureBreadcrumb('auth', 'change_password_submit');

    const result = await changePassword(values.password);
    setSubmitting(false);

    if (!result.success) {
      setGlobalError(result.error);
      return;
    }
    setMustChangePassword(false);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.pad}>
          <ScreenHeader title="Defina sua senha" />
          <Text variant="body" color="textSecondary" style={styles.intro}>
            Este e seu primeiro acesso{userEmail ? ` (${userEmail})` : ''}. Crie uma senha que so
            voce conheca.
          </Text>

          <FormSection title="Nova senha">
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  label="Nova senha"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  secureTextEntry
                  placeholder="Minimo 8 caracteres"
                  error={errors.password?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="confirm"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  label="Confirmar senha"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  secureTextEntry
                  placeholder="Repita a senha"
                  error={errors.confirm?.message}
                />
              )}
            />
            {globalError ? (
              <Text variant="caption" color="danger">
                {globalError}
              </Text>
            ) : null}
            <Button
              variant="primary"
              size="lg"
              loading={submitting}
              disabled={submitting}
              onPress={handleSubmit(onSubmit)}
              style={styles.fullBtn}
            >
              Salvar e continuar
            </Button>
          </FormSection>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  flex: {
    flex: 1,
  },
  pad: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  intro: {
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  fullBtn: {
    alignSelf: 'stretch',
    marginTop: spacing.md,
  },
});
