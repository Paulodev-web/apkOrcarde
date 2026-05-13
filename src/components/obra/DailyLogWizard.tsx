'use client';

import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/design-system/primitives/Button';
import { Text } from '@/design-system/primitives/Text';
import { colors } from '@/design-system/tokens/colors';
import { spacing } from '@/design-system/tokens/spacing';
import { StepIndicator } from '@/design-system/composed/StepIndicator';
import { DailyLogForm } from '@/components/daily-log/DailyLogForm';
import type { MetersPlanned, PlannedMaterial, WorkDailyLogRevision } from '@/types';
import type { PublishDailyLogInput } from '@/types/rpc';

type CrewOption = { id: string; name: string };

type Props = {
  workId: string;
  dailyLogId: string;
  logDate: string;
  isRepublish: boolean;
  lastRevision: WorkDailyLogRevision | null;
  crewOptions: CrewOption[];
  plannedMaterials: PlannedMaterial[];
  metersPlanned: MetersPlanned | null;
  lastRejectionReason?: string | null;
  onSubmit: (payload: PublishDailyLogInput, mediaPaths: string[]) => void;
  submitting: boolean;
};

export function DailyLogWizard(props: Props) {
  const [step, setStep] = useState<0 | 1 | 2>(0);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <StepIndicator totalSteps={3} currentStep={step} />
        <Text variant="caption" color="textMuted" style={styles.stepLabel}>
          Passo {step + 1} de 3
        </Text>
      </View>
      <View style={styles.formWrap}>
        <DailyLogForm {...props} wizardStep={step} />
      </View>
      <View style={styles.nav}>
        {step > 0 ? (
          <Button variant="ghost" onPress={() => setStep((s) => (s > 0 ? ((s - 1) as 0 | 1 | 2) : s))}>
            Voltar
          </Button>
        ) : (
          <View style={styles.navSpacer} />
        )}
        {step < 2 ? (
          <Button variant="primary" onPress={() => setStep((s) => (s < 2 ? ((s + 1) as 0 | 1 | 2) : s))}>
            Próximo
          </Button>
        ) : (
          <View style={styles.navSpacer} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceMuted },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  stepLabel: { marginTop: spacing.xs },
  formWrap: { flex: 1 },
  nav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  navSpacer: { minWidth: 48, minHeight: 48 },
});
