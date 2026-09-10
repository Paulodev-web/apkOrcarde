'use client';

import {
  AlertTriangle,
  ChevronRight,
  Flag,
  MapPin,
  Waves,
  Wrench,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/design-system/composed/BottomSheet';
import { Text } from '@/design-system/primitives/Text';
import { colors } from '@/design-system/tokens/colors';
import { radius } from '@/design-system/tokens/radius';
import { spacing } from '@/design-system/tokens/spacing';

type Props = {
  open: boolean;
  onClose: () => void;
  workId: string;
};

type Principal = {
  icon: LucideIcon;
  label: string;
  hint: string;
  href: string;
};

type Row = {
  icon: LucideIcon;
  label: string;
  hint: string;
  tint: string;
  bg: string;
  href: string;
};

/**
 * A folha do botao central.
 *
 * Os tres primeiros sao o que se executa numa rede eletrica: levanta o poste,
 * monta o equipamento nele, lanca o cabo entre postes. Sao o dia inteiro do
 * gerente, entao ocupam a faixa larga e vem antes de tudo.
 *
 * Impedimento vem logo abaixo, sozinho e em vermelho: e o registro mais raro
 * e o mais urgente — quando acontece, a obra parou. Nao pode dividir espaco
 * com os de rotina nem ficar escondido numa lista.
 *
 * O resto (diario, checklist, marco) e ritmo administrativo: acontece uma vez
 * por dia ou por etapa. Fica em lista.
 */
export function RegistrarSheet({ open, onClose, workId }: Props) {
  const router = useRouter();

  const go = (href: string) => {
    onClose();
    setTimeout(() => router.push(href as never), 0);
  };

  const principais: Principal[] = [
    {
      icon: MapPin,
      label: 'Poste',
      hint: 'levantei',
      href: `/(main)/obra/${workId}/postes`,
    },
    {
      icon: Wrench,
      label: 'Equipamento',
      hint: 'no poste',
      href: `/(main)/obra/${workId}/equipamento`,
    },
    {
      icon: Waves,
      label: 'Rede',
      hint: 'trecho',
      href: `/(main)/obra/${workId}/rede`,
    },
  ];

  // Diario e Checklist sairam daqui. O diario deixou de ser formulario e virou
  // leitura: a plataforma monta o dia a partir do que foi registrado, entao nao
  // ha o que o gerente digitar. O checklist saiu do produto.
  const rows: Row[] = [
    {
      icon: Flag,
      label: 'Marco',
      hint: 'concluir com evidência',
      tint: colors.textSecondary,
      bg: colors.neutralBg,
      href: `/(main)/obra/${workId}/marcos`,
    },
  ];

  return (
    <BottomSheet visible={open} onClose={onClose} title="Registrar" maxHeightRatio={0.78}>
      <View style={styles.body}>
        <View style={styles.principaisRow}>
          {principais.map((item) => {
            const Icon = item.icon;
            return (
              <Pressable
                key={item.label}
                accessibilityRole="button"
                accessibilityLabel={`${item.label} — ${item.hint}`}
                onPress={() => go(item.href)}
                style={({ pressed }) => [styles.principal, { opacity: pressed ? 0.85 : 1 }]}
              >
                <Icon size={26} color={colors.textInverse} strokeWidth={1.9} />
                <View style={styles.principalLabels}>
                  <Text variant="bodyBold" color="textInverse" numberOfLines={1}>
                    {item.label}
                  </Text>
                  <Text variant="caption" color="textOnDark" numberOfLines={1} style={styles.hint}>
                    {item.hint}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Sozinho, largo e vermelho: quando isso acontece, a obra parou. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Impedimento — a obra parou"
          onPress={() => go(`/(main)/obra/${workId}/alertas/novo`)}
          style={({ pressed }) => [styles.impedimento, { opacity: pressed ? 0.85 : 1 }]}
        >
          <AlertTriangle size={26} color={colors.danger} strokeWidth={2} />
          <View style={styles.impedimentoLabels}>
            <Text variant="bodyLargeBold" style={{ color: colors.dangerText }}>
              Impedimento
            </Text>
            <Text variant="caption" style={{ color: colors.dangerText }}>
              alguma coisa travou a obra
            </Text>
          </View>
          <ChevronRight size={20} color={colors.danger} strokeWidth={2} />
        </Pressable>

        <View>
          {rows.map((row, i) => {
            const Icon = row.icon;
            return (
              <Pressable
                key={row.label}
                accessibilityRole="button"
                onPress={() => go(row.href)}
                style={({ pressed }) => [
                  styles.row,
                  i > 0 && styles.rowDivider,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <View style={[styles.rowIcon, { backgroundColor: row.bg }]}>
                  <Icon size={22} color={row.tint} strokeWidth={1.9} />
                </View>
                <View style={styles.rowLabels}>
                  <Text variant="bodyLargeBold">{row.label}</Text>
                  <Text variant="caption" color="textSecondary">{row.hint}</Text>
                </View>
                <ChevronRight size={20} color={colors.textDisabled} strokeWidth={2} />
              </Pressable>
            );
          })}
        </View>

        <Text variant="caption" color="textMuted" style={styles.footnote}>
          Tudo salva no aparelho e envia sozinho.
        </Text>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.lg },

  principaisRow: { flexDirection: 'row', gap: spacing.sm },
  principal: {
    flex: 1,
    minHeight: 118,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    justifyContent: 'space-between',
  },
  principalLabels: { gap: 1 },
  hint: { fontSize: 13, lineHeight: 17 },

  impedimento: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 68,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.dangerBg,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
  },
  impedimentoLabels: { flex: 1, gap: 1 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 62,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: colors.surfaceSunken },
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabels: { flex: 1, gap: 1 },
  footnote: { textAlign: 'center' },
});
