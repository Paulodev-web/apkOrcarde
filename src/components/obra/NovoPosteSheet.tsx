'use client';

import { Camera, Check, MapPin, X } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/design-system/composed/BottomSheet';
import { Button } from '@/design-system/primitives/Button';
import { Text } from '@/design-system/primitives/Text';
import { TextInput } from '@/design-system/primitives/TextInput';
import { colors } from '@/design-system/tokens/colors';
import { radius } from '@/design-system/tokens/radius';
import { spacing } from '@/design-system/tokens/spacing';
import { POLE_LIMITS } from '@/constants/limits';
import { captureGps, type GpsReading } from '@/lib/location/gps';
import { pickImage } from '@/lib/media/capture';
import { enqueue } from '@/lib/offline/outbox';
import { poleInstallationMediaPath } from '@/constants/paths';
import type { MediaAsset, WorkPoleInstallation } from '@/types';
import type { RecordPoleInstallationInput } from '@/types/rpc';
import { uuidV4 } from '@/utils/uuid';

type Props = {
  workId: string;
  /** Onde o dedo encostou, já no quadro lógico 6000×6000. */
  coords: { x: number; y: number } | null;
  onClose: () => void;
  /**
   * Entrega o poste recém-criado para a tela pintar o pino na hora.
   *
   * Sem isso a tela só descobre o poste na próxima ida ao servidor, e no
   * canteiro sem sinal essa ida não acontece nunca.
   */
  onSaved: (pole: WorkPoleInstallation) => void;
};

/**
 * Confirmação do poste levantado.
 *
 * A foto é obrigatória: um poste registrado sem evidência não serve para o
 * engenheiro validar nem para medição. O GPS entra sozinho e nunca bloqueia —
 * no canteiro pode não haver céu aberto, e perder o registro por causa disso
 * seria pior que registrar sem coordenada.
 */
export function NovoPosteSheet({ workId, coords, onClose, onSaved }: Props) {
  const [numeracao, setNumeracao] = useState('');
  const [tipo, setTipo] = useState('');
  const [foto, setFoto] = useState<MediaAsset | null>(null);
  const [gps, setGps] = useState<GpsReading | null>(null);
  const [buscandoGps, setBuscandoGps] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const aberto = coords != null;

  useEffect(() => {
    if (!aberto) {
      setNumeracao('');
      setTipo('');
      setFoto(null);
      setGps(null);
      return;
    }
    setBuscandoGps(true);
    void captureGps()
      .then((reading) => setGps(reading))
      .catch(() => setGps(null))
      .finally(() => setBuscandoGps(false));
  }, [aberto]);

  const tirarFoto = useCallback(async () => {
    const asset = await pickImage('camera');
    if (asset) setFoto(asset);
  }, []);

  const salvar = useCallback(async () => {
    if (!coords || !foto) return;
    setSalvando(true);
    try {
      const clientEventId = uuidV4();
      const installationId = uuidV4();
      const fileUuid = uuidV4();
      const ext = foto.fileName.split('.').pop() ?? 'jpg';

      const payload: RecordPoleInstallationInput = {
        work_id: workId,
        installation_id: installationId,
        x_coord: Math.round(coords.x),
        y_coord: Math.round(coords.y),
        gps_lat: gps?.latitude ?? null,
        gps_lng: gps?.longitude ?? null,
        gps_accuracy_meters: gps?.accuracy ?? null,
        numbering: numeracao.trim() || null,
        pole_type: tipo.trim() || null,
        notes: null,
        // Hora do aparelho, não da sincronização: preserva a linha do tempo
        // real quando o registro passa o dia inteiro na fila.
        installed_at: new Date().toISOString(),
        client_event_id: clientEventId,
        media: [
          {
            id: fileUuid,
            kind: 'image',
            storage_path: poleInstallationMediaPath(workId, installationId, fileUuid, ext),
            mime_type: foto.mimeType,
            file_name: foto.fileName,
            file_size_bytes: foto.fileSize,
            width: foto.width ?? null,
            height: foto.height ?? null,
            duration_seconds: null,
            is_primary: true,
          },
        ],
      };

      await enqueue({
        client_event_id: clientEventId,
        action_type: 'record_pole_installation',
        payload,
        media_paths: [foto.uri],
      });

      // O poste vale a partir de agora, não a partir do envio.
      //
      // `enqueue` só grava no aparelho; quem manda para o servidor é o worker,
      // segundos depois (ou dias, sem sinal). Devolvendo o poste aqui, a tela
      // pinta o pino imediatamente, com ou sem rede.
      onSaved({
        id: installationId,
        work_id: workId,
        created_by: '',
        x_coord: payload.x_coord,
        y_coord: payload.y_coord,
        gps_lat: payload.gps_lat,
        gps_lng: payload.gps_lng,
        gps_accuracy_meters: payload.gps_accuracy_meters,
        numbering: payload.numbering,
        pole_type: payload.pole_type,
        notes: payload.notes,
        installed_at: payload.installed_at,
        status: 'installed',
        removed_at: null,
        removed_by: null,
        client_event_id: clientEventId,
        created_at: payload.installed_at,
      });
    } catch {
      Alert.alert('Erro', 'Não foi possível guardar o poste. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  }, [coords, foto, workId, gps, numeracao, tipo, onSaved]);

  const gpsRuim = gps != null && gps.accuracy != null && gps.accuracy > POLE_LIMITS.GPS_LOW_ACCURACY_METERS;

  return (
    <BottomSheet visible={aberto} onClose={onClose} title="Poste levantado" maxHeightRatio={0.82}>
      <View style={styles.body}>
        <View style={styles.linha}>
          <MapPin size={18} color={colors.primary} strokeWidth={2} />
          <Text variant="caption" color="textSecondary" style={styles.flex}>
            {coords ? `na planta em ${Math.round(coords.x)}, ${Math.round(coords.y)}` : ''}
          </Text>
        </View>

        {/* Sem foto não sai registro: é a prova que o engenheiro valida. */}
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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tirar foto do poste"
            onPress={() => void tirarFoto()}
            style={({ pressed }) => [styles.fotoVazia, { opacity: pressed ? 0.8 : 1 }]}
          >
            <Camera size={30} color={colors.primary} strokeWidth={1.8} />
            <Text variant="bodyBold" color="primary">Fotografar o poste</Text>
            <Text variant="caption" color="textMuted">obrigatório</Text>
          </Pressable>
        )}

        <View style={styles.dupla}>
          <View style={styles.flex}>
            <TextInput
              label="Numeração"
              value={numeracao}
              onChangeText={setNumeracao}
              placeholder="P-10"
              autoCapitalize="characters"
            />
          </View>
          <View style={styles.flex}>
            <TextInput label="Tipo" value={tipo} onChangeText={setTipo} placeholder="DT 11/300" />
          </View>
        </View>

        <View style={[styles.gps, gpsRuim && styles.gpsRuim]}>
          <MapPin
            size={17}
            color={gps ? (gpsRuim ? colors.warning : colors.success) : colors.textMuted}
            strokeWidth={2}
          />
          <Text
            variant="caption"
            style={{
              flex: 1,
              color: gps ? (gpsRuim ? colors.warningText : colors.successText) : colors.textMuted,
            }}
          >
            {buscandoGps
              ? 'procurando GPS…'
              : gps
                ? `GPS ±${Math.round(gps.accuracy ?? 0)} m${gpsRuim ? ' · precisão baixa' : ''}`
                : 'sem GPS — o registro vai sem coordenada'}
          </Text>
        </View>

        <Button
          block
          size="lg"
          icon={Check}
          loading={salvando}
          disabled={!foto}
          onPress={() => void salvar()}
        >
          {foto ? 'Registrar poste' : 'Fotografe para registrar'}
        </Button>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg, paddingBottom: spacing.lg },
  flex: { flex: 1 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dupla: { flexDirection: 'row', gap: spacing.md },
  fotoVazia: {
    height: 132,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.borderAccent,
    backgroundColor: colors.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  fotoBox: { height: 132, borderRadius: radius.lg, overflow: 'hidden' },
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
  gps: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSunken,
  },
  gpsRuim: { backgroundColor: colors.warningBg },
});
