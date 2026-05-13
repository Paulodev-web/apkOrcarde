import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Badge, type BadgeVariant } from '@/design-system/primitives/Badge';
import type {
  AlertStatus,
  ChecklistStatus,
  DailyLogStatus,
  MilestoneStatus,
  PoleInstallationStatus,
  WorkStatus,
} from '@/types';

type WorkProps = { kind: 'work'; status: WorkStatus };
type MilestoneProps = { kind: 'milestone'; status: MilestoneStatus };
type DailyLogProps = { kind: 'daily_log'; status: DailyLogStatus };
type ChecklistProps = { kind: 'checklist'; status: ChecklistStatus };
type AlertProps = { kind: 'alert'; status: AlertStatus };
type PoleProps = { kind: 'pole'; status: PoleInstallationStatus };

export type StatusBadgeProps =
  | WorkProps
  | MilestoneProps
  | DailyLogProps
  | ChecklistProps
  | AlertProps
  | PoleProps;

function mapWork(status: WorkStatus): { variant: BadgeVariant; label: string } {
  const m: Record<WorkStatus, { variant: BadgeVariant; label: string }> = {
    planned: { variant: 'neutral', label: 'Planejada' },
    in_progress: { variant: 'info', label: 'Em andamento' },
    paused: { variant: 'warning', label: 'Pausada' },
    completed: { variant: 'success', label: 'Concluída' },
    cancelled: { variant: 'danger', label: 'Cancelada' },
  };
  return m[status];
}

function mapMilestone(status: MilestoneStatus): { variant: BadgeVariant; label: string } {
  const m: Record<MilestoneStatus, { variant: BadgeVariant; label: string }> = {
    pending: { variant: 'neutral', label: 'Pendente' },
    in_progress: { variant: 'info', label: 'Em andamento' },
    awaiting_approval: { variant: 'warning', label: 'Aguardando aprovação' },
    approved: { variant: 'success', label: 'Aprovado' },
    rejected: { variant: 'danger', label: 'Rejeitado' },
  };
  return m[status];
}

function mapDailyLog(status: DailyLogStatus): { variant: BadgeVariant; label: string } {
  const m: Record<DailyLogStatus, { variant: BadgeVariant; label: string }> = {
    pending_approval: { variant: 'warning', label: 'Aguardando aprovação' },
    approved: { variant: 'success', label: 'Aprovado' },
    rejected: { variant: 'danger', label: 'Rejeitado' },
  };
  return m[status];
}

function mapChecklist(status: ChecklistStatus): { variant: BadgeVariant; label: string } {
  const m: Record<ChecklistStatus, { variant: BadgeVariant; label: string }> = {
    pending: { variant: 'neutral', label: 'Pendente' },
    in_progress: { variant: 'info', label: 'Em andamento' },
    awaiting_validation: { variant: 'warning', label: 'Aguardando validação' },
    validated: { variant: 'success', label: 'Validado' },
    returned: { variant: 'danger', label: 'Devolvido' },
  };
  return m[status];
}

function mapAlert(status: AlertStatus): { variant: BadgeVariant; label: string } {
  const m: Record<AlertStatus, { variant: BadgeVariant; label: string }> = {
    open: { variant: 'danger', label: 'Aberto' },
    in_progress: { variant: 'warning', label: 'Em andamento' },
    resolved_in_field: { variant: 'success', label: 'Resolvido em campo' },
    closed: { variant: 'neutral', label: 'Encerrado' },
  };
  return m[status];
}

function mapPole(status: PoleInstallationStatus): { variant: BadgeVariant; label: string } {
  const m: Record<PoleInstallationStatus, { variant: BadgeVariant; label: string }> = {
    installed: { variant: 'success', label: 'Instalado' },
    removed: { variant: 'neutral', label: 'Removido' },
  };
  return m[status];
}

export function StatusBadge(props: StatusBadgeProps & { icon?: LucideIcon }) {
  const { icon } = props;
  const mapped =
    props.kind === 'work'
      ? mapWork(props.status)
      : props.kind === 'milestone'
        ? mapMilestone(props.status)
        : props.kind === 'daily_log'
          ? mapDailyLog(props.status)
          : props.kind === 'checklist'
            ? mapChecklist(props.status)
            : props.kind === 'alert'
              ? mapAlert(props.status)
              : mapPole(props.status);

  return (
    <View style={styles.wrap}>
      <Badge variant={mapped.variant} icon={icon}>
        {mapped.label}
      </Badge>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'flex-start',
  },
});
