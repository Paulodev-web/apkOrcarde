import { zodResolver } from '@hookform/resolvers/zod';
import { LinearGradient } from 'expo-linear-gradient';
import { Eye, EyeOff } from 'lucide-react-native';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Image, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { Button } from '@/design-system/primitives/Button';
import { Text } from '@/design-system/primitives/Text';
import { TextInput } from '@/design-system/primitives/TextInput';
import { colors, gradients } from '@/design-system/tokens/colors';
import { spacing } from '@/design-system/tokens/spacing';
import { signInApkUser } from '@/lib/auth/session';
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
  const [showPassword, setShowPassword] = useState(false);
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
    const result = await signInApkUser(values.email.trim(), values.password);
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
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.hero}>
          <LinearGradient colors={[...gradients.hero]} style={styles.heroGradient}>
            <Image
              source={require('../../assets/OnEngenharia.webp')}
              style={styles.logo}
              accessibilityIgnoresInvertColors
            />
            <Text variant="heading1" color="textInverse" style={styles.heroTitle}>
              OrçaRede
            </Text>
            <Text variant="bodyLarge" color="textInverse" style={styles.heroSubtitle}>
              Gestão de redes elétricas
            </Text>
          </LinearGradient>
        </View>

        <View style={styles.form}>
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                label="Email"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="seu@email.com"
                error={errors.email?.message}
                editable={!submitting}
              />
            )}
          />
          <View style={styles.gapMd} />
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                label="Senha"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                secureTextEntry={!showPassword}
                placeholder="Sua senha"
                error={errors.password?.message}
                rightIcon={showPassword ? EyeOff : Eye}
                onRightIconPress={() => setShowPassword((s) => !s)}
                editable={!submitting}
              />
            )}
          />
          <View style={styles.gapXl} />
          {globalError ? (
            <Text variant="caption" color="danger" style={styles.err}>
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
            Entrar
          </Button>
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
  hero: {
    flex: 1,
  },
  heroGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  logo: {
    width: 120,
    height: 120,
  },
  heroTitle: {
    marginTop: spacing.lg,
    opacity: 1,
  },
  heroSubtitle: {
    marginTop: spacing.sm,
    opacity: 0.85,
    textAlign: 'center',
  },
  form: {
    flex: 1,
    padding: spacing.xxl,
    justifyContent: 'flex-start',
  },
  gapMd: {
    height: spacing.md,
  },
  gapXl: {
    height: spacing.xl,
  },
  err: {
    marginBottom: spacing.sm,
  },
  fullBtn: {
    alignSelf: 'stretch',
  },
});
