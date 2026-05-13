'use client';

import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/design-system/primitives/Text';
import { colors } from '@/design-system/tokens/colors';
import { radius } from '@/design-system/tokens/radius';
import { spacing } from '@/design-system/tokens/spacing';
import type { AlertSeverity } from '@/types';

type Props = {
  onSelect: (severity: AlertSeverity) => void;
};

const ROWS: { severity: AlertSeverity; title: string; subtitle: string; bg: string; fg: keyof typeof colors }[] = [
  {
    severity: 'critical',
    title: 'Crítico',
    subtitle: 'Risco imediato à segurança ou continuidade da obra',
    bg: colors.severityCritical,
    fg: 'textInverse',
  },
  {
    severity: 'high',
    title: 'Alto',
    subtitle: 'Atenção urgente — impacto relevante',
    bg: colors.severityHigh,
    fg: 'textInverse',
  },
  {
    severity: 'medium',
    title: 'Médio',
    subtitle: 'Importante — requer acompanhamento',
    bg: colors.severityMedium,
    fg: 'textInverse',
  },
  {
    severity: 'low',
    title: 'Baixo',
    subtitle: 'Baixa prioridade — registrar para histórico',
    bg: colors.severityLow,
    fg: 'textPrimary',
  },
];

export function AlertSeveritySelector({ onSelect }: Props) {
  return (
    <View style={styles.root}>
      <Text variant="heading3" color="textPrimary" style={styles.heading}>
        Gravidade do alerta
      </Text>
      <Text variant="body" color="textSecondary" style={styles.intro}>
        Escolha a opção que melhor descreve a urgência.
      </Text>
      {ROWS.map((row) => (
        <Pressable
          key={row.severity}
          accessibilityRole="button"
          accessibilityLabel={`Severidade ${row.title}`}
          onPress={() => onSelect(row.severity)}
          style={({ pressed }) => [
            styles.btn,
            { backgroundColor: row.bg, opacity: pressed ? 0.88 : 1 },
          ]}
        >
          <Text variant="heading3" color={row.fg}>
            {row.title}
          </Text>
          <Text variant="caption" color={row.fg} style={styles.sub}>
            {row.subtitle}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md, paddingVertical: spacing.md },
  heading: { marginBottom: spacing.xs },
  intro: { marginBottom: spacing.lg },
  btn: {
    minHeight: 80,
    borderRadius: radius.md,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  sub: { marginTop: spacing.xs, opacity: 0.95 },
});
