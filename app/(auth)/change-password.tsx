import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

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
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Defina sua senha</Text>
          <Text style={styles.subtitle}>
            Este e seu primeiro acesso{userEmail ? ` (${userEmail})` : ''}. Crie uma senha que so
            voce conheca.
          </Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Nova senha</Text>
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[styles.input, errors.password ? styles.inputError : null]}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                placeholder="Minimo 8 caracteres"
                placeholderTextColor="#8a94a6"
                value={value}
                onBlur={onBlur}
                onChangeText={onChange}
                editable={!submitting}
              />
            )}
          />
          {errors.password ? (
            <Text style={styles.fieldError}>{errors.password.message}</Text>
          ) : null}

          <Text style={[styles.label, styles.labelSpacing]}>Confirmar senha</Text>
          <Controller
            control={control}
            name="confirm"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[styles.input, errors.confirm ? styles.inputError : null]}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                placeholder="Repita a senha"
                placeholderTextColor="#8a94a6"
                value={value}
                onBlur={onBlur}
                onChangeText={onChange}
                editable={!submitting}
              />
            )}
          />
          {errors.confirm ? <Text style={styles.fieldError}>{errors.confirm.message}</Text> : null}

          {globalError ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{globalError}</Text>
            </View>
          ) : null}

          <Pressable
            style={({ pressed }) => [
              styles.submit,
              submitting ? styles.submitDisabled : null,
              pressed && !submitting ? styles.submitPressed : null,
            ]}
            onPress={handleSubmit(onSubmit)}
            disabled={submitting}
            accessibilityRole="button"
          >
            {submitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.submitText}>Salvar e continuar</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  header: {
    alignItems: 'flex-start',
    marginBottom: 32,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#0a3a82',
  },
  subtitle: {
    marginTop: 12,
    fontSize: 14,
    color: '#3b4452',
    lineHeight: 20,
  },
  form: {
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1c1f24',
    marginBottom: 8,
  },
  labelSpacing: {
    marginTop: 16,
  },
  input: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cfd6e0',
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#1c1f24',
    backgroundColor: '#f6f8fb',
  },
  inputError: {
    borderColor: '#c0392b',
  },
  fieldError: {
    marginTop: 6,
    color: '#c0392b',
    fontSize: 13,
  },
  errorBanner: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#fdecea',
    borderLeftWidth: 4,
    borderLeftColor: '#c0392b',
  },
  errorBannerText: {
    color: '#7a1f17',
    fontSize: 14,
  },
  submit: {
    marginTop: 24,
    minHeight: 52,
    borderRadius: 10,
    backgroundColor: '#0a3a82',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitDisabled: {
    opacity: 0.7,
  },
  submitPressed: {
    backgroundColor: '#072a60',
  },
  submitText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
