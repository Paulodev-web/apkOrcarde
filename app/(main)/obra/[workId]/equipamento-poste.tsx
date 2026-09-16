'use client';

import { useLocalSearchParams, useRouter } from 'expo-router';

import { useWorkId } from '@/hooks/useWorkId';
import { Camera, Check, X } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ObraHeader } from '@/components/obra/ObraHeader';
import { Button } from '@/design-system/primitives/Button';
import { Text } from '@/design-system/primitives/Text';
import { TextInput } from '@/design-system/primitives/TextInput';
import { colors } from '@/design-system/tokens/colors';
import { radius } from '@/design-system/tokens/radius';
import { spacing } from '@/design-system/tokens/spacing';
import { poleEquipmentMediaPath } from '@/constants/paths';
import { pickImage } from '@/lib/media/capture';
import { enqueue } from '@/lib/offline/outbox';
import type { MediaAsset } from '@/types';
import type { RecordPoleEquipmentInput } from '@/types/rpc';
import { uuidV4 } from '@/utils/uuid';

/**
 * Registro de equipamento montado no poste.
 *
 * Sem catalogo: o gerente nao seleciona estrutura de uma lista, so fotografa
 * o que montou e escreve o que e. O catalogo dependia do orcamento copiar as
 * estruturas pro projeto, o que nunca aconteceu — travava o registro inteiro
 * por um dado que a obra nao tinha.
 */
export default function EquipamentoPosteScreen() {
  const params = useLocalSearchParams<{
    workId: string;
    installationId: string;
    numbering: string;
  }>();
  const workId = useWorkId();
  const installationId = typeof params.installationId === 'string' ? params.installationId : '';
  const numbering = typeof params.numbering === 'string' ? params.numbering : 'poste';
  const router = useRouter();

  const [foto, setFoto] = useState<MediaAsset | null>(null);
  const [descricao, setDescricao] = useState('');
  const [salvando, setSalvando] = useState(false);

  const podeSalvar = foto != null && descricao.trim().length > 0;

  const tirarFoto = useCallback(async () => {
    const asset = await pickImage('camera');
    if (asset) setFoto(asset);
  }, []);

  const salvar = useCallback(async () => {
    if (!foto || descricao.trim().length === 0) return;
    setSalvando(true);
    try {
      const clientEventId = uuidV4();
      const equipmentId = uuidV4();
      const fileUuid = uuidV4();
      const ext = foto.fileName.split('.').pop() ?? 'jpg';

      const payload: RecordPoleEquipmentInput = {
        work_id: workId,
        equipment_id: equipmentId,
        installation_id: installationId,
        notes: descricao.trim(),
        installed_at: new Date().toISOString(),
        client_event_id: clientEventId,
        media: [
          {
            kind: 'image',
            storage_path: poleEquipmentMediaPath(workId, equipmentId, fileUuid, ext),
            mime_type: foto.mimeType,
            file_name: foto.fileName,
            file_size_bytes: foto.fileSize,
            is_primary: true,
          },
        ],
      };

      // Grava no aparelho antes de qualquer rede: a partir daqui o registro
      // existe para o gerente, mesmo que o envio demore horas.
      await enqueue({
        client_event_id: clientEventId,
        action_type: 'record_pole_equipment',
        payload,
        media_paths: [foto.uri],
      });

      router.back();
    } catch {
      Alert.alert('Erro', 'Não foi possível guardar o registro. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  }, [foto, descricao, workId, installationId, router]);

  return (
    <View style={styles.root}>
      <ObraHeader title={numbering} subtitle="O que foi montado?" />

      <ScrollView contentContainerStyle={styles.content}>
        {foto ? (
          <View style={styles.fotoBox}>
            <Image source={{ uri: foto.uri }} style={styles.foto} accessibilityIgnoresInvertColors />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Remover foto"
              onPress={() => setFoto(null)}
              style={styles.fotoRemover}
            >
              <X size={16} color={colors.textInverse} strokeWidth={3} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.fotoAcoes}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tirar foto do equipamento"
              onPress={() => void tirarFoto()}
              style={({ pressed }) => [styles.fotoVazia, { opacity: pressed ? 0.8 : 1 }]}
            >
              <Camera size={30} color={colors.primary} strokeWidth={1.8} />
              <Text variant="bodyBold" color="primary">Fotografar o equipamento</Text>
              <Text variant="caption" color="textMuted">obrigatório</Text>
            </Pressable>
          </View>
        )}

        <TextInput
          label="Descrição"
          value={descricao}
          onChangeText={setDescricao}
          placeholder="Ex: transformador 45 kVA, chave fusível"
          multiline
          numberOfLines={4}
        />
      </ScrollView>

      <View style={styles.footer}>
        <Button
          block
          size="lg"
          icon={Check}
          loading={salvando}
          disabled={!podeSalvar}
          onPress={() => void salvar()}
        >
          {podeSalvar ? 'Registrar equipamento' : 'Foto e descrição obrigatórias'}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceMuted },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.lg },
  fotoAcoes: { gap: spacing.sm },
  fotoVazia: {
    height: 160,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.borderAccent,
    backgroundColor: colors.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  fotoBox: { height: 200, borderRadius: radius.lg, overflow: 'hidden' },
  foto: { width: '100%', height: '100%' },
  fotoRemover: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: 'rgba(24,24,22,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
});
