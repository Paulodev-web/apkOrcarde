import { zodResolver } from '@hookform/resolvers/zod';
import { DrawerActions, useNavigation } from '@react-navigation/native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Lock, Menu, RefreshCw } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Linking, Pressable, View } from 'react-native';
import { z } from 'zod';

import { BottomSheet } from '@/design-system/composed/BottomSheet';
import { Button } from '@/design-system/primitives/Button';
import { Text } from '@/design-system/primitives/Text';
import { TextInput } from '@/design-system/primitives/TextInput';
import { FormSection } from '@/design-system/layouts/FormSection';
import { ScreenContainer } from '@/design-system/layouts/ScreenContainer';
import { ScreenHeader } from '@/design-system/layouts/ScreenHeader';
import { ReadOnlyField } from '@/design-system/composed/ReadOnlyField';
import { spacing } from '@/design-system/tokens/spacing';
import { changePassword } from '@/lib/auth/session';
import { captureBreadcrumb } from '@/lib/sentry';
import { outboxEmitter } from '@/lib/offline/outbox';
import { useSessionStore } from '@/stores/session.store';
import { useSyncStore } from '@/stores/sync.store';

const pwdSchema = z
  .object({
    password: z.string().min(8, 'A senha precisa ter no minimo 8 caracteres'),
    confirm: z.string().min(8, 'A senha precisa ter no minimo 8 caracteres'),
  })
  .refine((data) => data.password === data.confirm, {
    message: 'As senhas nao coincidem',
    path: ['confirm'],
  });

type PwdForm = z.infer<typeof pwdSchema>;

export default function ConfiguracoesScreen() {
  const navigation = useNavigation();
  const user = useSessionStore((s) => s.user);
  const pendingCount = useSyncStore((s) => s.pendingCount);
  const setMustChangePassword = useSessionStore((s) => s.setMustChangePassword);

  const [notifStatus, setNotifStatus] = useState<string>('—');
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    void Notifications.getPermissionsAsync().then((r) => {
      setNotifStatus(r.status === 'granted' ? 'Concedidas' : r.status === 'denied' ? 'Negadas' : String(r.status));
    });
  }, []);

  const appVariant =
    (Constants.expoConfig?.extra as { appVariant?: string } | undefined)?.appVariant ?? '—';
  const version = Constants.expoConfig?.version ?? '1.0.0';

  const forceSync = useCallback(() => {
    outboxEmitter.emit();
  }, []);

  return (
    <ScreenContainer scrollable background="muted">
      <ScreenHeader
        title="Configurações"
        leftAction={{
          icon: Menu,
          onPress: () => navigation.dispatch(DrawerActions.openDrawer()),
          accessibilityLabel: 'Abrir menu',
        }}
      />

      <FormSection title="Conta">
        <ReadOnlyField label="Nome" value={user?.fullName ?? '—'} />
        <ReadOnlyField label="Email" value={user?.email ?? '—'} />
        <Button variant="secondary" icon={Lock} onPress={() => setSheetOpen(true)}>
          Trocar senha
        </Button>
      </FormSection>

      <FormSection title="Notificações">
        <ReadOnlyField label="Status" value={notifStatus} />
        {notifStatus === 'Negadas' ? (
          <Pressable
            onPress={() => void Linking.openSettings()}
            accessibilityRole="button"
            style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1, minHeight: 48, justifyContent: 'center' }]}
          >
            <Text variant="bodyBold" color="primary">
              Abrir configurações do sistema
            </Text>
          </Pressable>
        ) : null}
      </FormSection>

      <FormSection title="Sincronização">
        <ReadOnlyField label="Pendentes" value={String(pendingCount)} />
        <Button variant="ghost" icon={RefreshCw} onPress={forceSync}>
          Forçar sincronização
        </Button>
      </FormSection>

      <FormSection title="Sobre o app">
        <ReadOnlyField label="Versão" value={version} />
        <ReadOnlyField label="Ambiente" value={String(appVariant)} />
      </FormSection>

      <ChangePasswordSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSuccess={() => {
          setMustChangePassword(false);
          setSheetOpen(false);
        }}
      />
    </ScreenContainer>
  );
}

function ChangePasswordSheet({
  visible,
  onClose,
  onSuccess,
}: {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PwdForm>({
    resolver: zodResolver(pwdSchema),
    defaultValues: { password: '', confirm: '' },
  });

  useEffect(() => {
    if (!visible) {
      reset();
      setGlobalError(null);
    }
  }, [visible, reset]);

  const onSubmit = async (values: PwdForm) => {
    setSubmitting(true);
    setGlobalError(null);
    captureBreadcrumb('auth', 'change_password_settings');
    const result = await changePassword(values.password);
    setSubmitting(false);
    if (!result.success) {
      setGlobalError(result.error);
      return;
    }
    reset();
    onSuccess();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Trocar senha">
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
      <View style={{ height: spacing.md }} />
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
        <Text variant="caption" color="danger" style={{ marginTop: spacing.sm }}>
          {globalError}
        </Text>
      ) : null}
      <View style={{ height: spacing.lg }} />
      <Button
        variant="primary"
        loading={submitting}
        disabled={submitting}
        onPress={handleSubmit(onSubmit)}
        style={{ alignSelf: 'stretch' }}
      >
        Salvar
      </Button>
    </BottomSheet>
  );
}

