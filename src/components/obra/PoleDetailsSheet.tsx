import { MapPin } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/design-system/composed/BottomSheet';
import { Button } from '@/design-system/primitives/Button';
import { StatusBadge } from '@/design-system/composed/StatusBadge';
import { Text } from '@/design-system/primitives/Text';
import { colors } from '@/design-system/tokens/colors';
import { spacing } from '@/design-system/tokens/spacing';
import { relativeTimePtBr } from '@/utils/relativeTime';

export type SelectedPole =
  | {
      kind: 'installed';
      id: string;
      numbering: string | null;
      poleType: string | null;
      gpsLat: number | null;
      gpsLng: number | null;
      gpsAccuracyMeters: number | null;
      notes: string | null;
      installedAt: string;
    }
  | {
      kind: 'planned';
      id: string;
      numbering: string | null;
      poleType: string | null;
    };

type Props = {
  pole: SelectedPole | null;
  onClose: () => void;
  /** Toque em "levantei este poste", num poste que o projeto previu. */
  onLevantar?: (pole: Extract<SelectedPole, { kind: 'planned' }>) => void;
};

export function PoleDetailsSheet({ pole, onClose, onLevantar }: Props) {
  const title = poleLabel(pole);

  return (
    <BottomSheet visible={pole != null} onClose={onClose} title={title} maxHeightRatio={0.55}>
      {pole == null ? null : pole.kind === 'installed' ? (
        <InstalledBody pole={pole} />
      ) : (
        <PlannedBody pole={pole} onLevantar={onLevantar} />
      )}
    </BottomSheet>
  );
}

function InstalledBody({
  pole,
}: {
  pole: Extract<SelectedPole, { kind: 'installed' }>;
}) {
  const gps =
    pole.gpsLat != null && pole.gpsLng != null
      ? pole.gpsAccuracyMeters != null
        ? `GPS ±${Math.round(pole.gpsAccuracyMeters)} m`
        : 'GPS registrado'
      : 'Sem GPS';

  return (
    <View style={styles.body}>
      <View style={styles.row}>
        <StatusBadge kind="pole" status="installed" />
        {pole.poleType ? (
          <View style={styles.typeChip}>
            <Text variant="captionBold" color="textSecondary">
              {pole.poleType}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.meta}>
        <MapPin size={16} color={pole.gpsLat != null ? colors.success : colors.textMuted} strokeWidth={2} />
        <Text variant="caption" style={{ color: pole.gpsLat != null ? colors.successText : colors.textMuted }}>
          {gps}
        </Text>
      </View>

      <Text variant="caption" color="textSecondary">
        Marcado {relativeTimePtBr(pole.installedAt)}
      </Text>

      {pole.notes ? (
        <Text variant="body" color="textPrimary">
          {pole.notes}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * A ficha de um poste que ainda nao foi levantado.
 *
 * E aqui que o poste cinza vira verde. O gerente nao cria poste nem escolhe
 * onde ele fica: ele confirma que levantou um que o projeto ja desenhou. Um
 * botao so, porque nesta tela existe uma acao possivel.
 */
function PlannedBody({
  pole,
  onLevantar,
}: {
  pole: Extract<SelectedPole, { kind: 'planned' }>;
  onLevantar?: (pole: Extract<SelectedPole, { kind: 'planned' }>) => void;
}) {
  return (
    <View style={styles.body}>
      {pole.poleType ? (
        <View style={styles.typeChip}>
          <Text variant="captionBold" color="textSecondary">
            {pole.poleType}
          </Text>
        </View>
      ) : null}
      <Text variant="body" color="textSecondary">
        Do projeto, ainda não levantado.
      </Text>

      {onLevantar ? (
        <View style={styles.acao}>
          <Button variant="primary" onPress={() => onLevantar(pole)}>
            Levantei este poste
          </Button>
          <Text variant="caption" color="textMuted">
            Pede foto e confirma o tipo no passo seguinte.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function poleLabel(pole: SelectedPole | null): string {
  if (!pole) return 'Poste';
  const n = pole.numbering?.trim();
  return n ? `Poste ${n}` : pole.kind === 'installed' ? 'Poste instalado' : 'Poste do projeto';
}

const styles = StyleSheet.create({
  body: { gap: spacing.md, paddingBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  typeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    backgroundColor: colors.surfaceSunken,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  acao: { gap: spacing.sm, paddingTop: spacing.xs },
});
