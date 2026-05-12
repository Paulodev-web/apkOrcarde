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

import { signInManager } from '@/lib/auth/session';
import { captureBreadcrumb } from '@/lib/sentry';
import { useSessionStore } from '@/stores/session.store';

const schema = z.object({
  email: z.string().min(1, 'Informe seu email').email('Email invalido'),
  password: z.string().min(6, 'A senha precisa ter no minimo 6 caracteres'),
});

type FormValues = z.infer<typeof schema>;

export default function LoginScreen() {
  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const setSession = useSessionStore((s) => s.setSession);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    setGlobalError(null);
    captureBreadcrumb('auth', 'login_submit');
    const result = await signInManager(values.email.trim(), values.password);
    setSubmitting(false);

    if (!result.success) {
      setGlobalError(result.error);
      return;
    }
    setSession(result.data);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.title}>OrcaRede</Text>
          <Text style={styles.subtitle}>Acesso do gerente de obra</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[styles.input, errors.email ? styles.inputError : null]}
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="seu@email.com"
                placeholderTextColor="#8a94a6"
                value={value}
                onBlur={onBlur}
                onChangeText={onChange}
                editable={!submitting}
              />
            )}
          />
          {errors.email ? <Text style={styles.fieldError}>{errors.email.message}</Text> : null}

          <Text style={[styles.label, styles.labelSpacing]}>Senha</Text>
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[styles.input, errors.password ? styles.inputError : null]}
                autoCapitalize="none"
                autoComplete="current-password"
                autoCorrect={false}
                secureTextEntry
                placeholder="Sua senha"
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
              <Text style={styles.submitText}>Entrar</Text>
            )}
          </Pressable>

          <Text style={styles.footerHint}>
            Sua senha foi enviada pelo engenheiro responsavel pela obra.
          </Text>
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
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#0a3a82',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 16,
    color: '#3b4452',
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
  footerHint: {
    marginTop: 24,
    color: '#5a6473',
    fontSize: 13,
    lineHeight: 18,
  },
});
