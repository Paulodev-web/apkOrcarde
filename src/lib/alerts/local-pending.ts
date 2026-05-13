import type { WorkAlert, AlertStatus, AlertSeverity, AlertCategory, OutboxItem } from '@/types';
import type { OpenAlertInput } from '@/types/rpc';
import { getPendingItemsByAction } from '@/lib/offline/outbox';

export async function getLocalPendingAlerts(workId: string): Promise<WorkAlert[]> {
  const items = await getPendingItemsByAction('open_alert', workId);
  return items.map(outboxItemToLocalAlert).filter(Boolean) as WorkAlert[];
}

export async function getLocalPendingAlertActionIds(
  workId: string,
): Promise<Set<string>> {
  const resolveItems = await getPendingItemsByAction('resolve_alert_in_field', workId);
  const commentItems = await getPendingItemsByAction('add_alert_comment', workId);

  const ids = new Set<string>();
  for (const item of [...resolveItems, ...commentItems]) {
    try {
      const payload = JSON.parse(item.payload) as { alert_id: string };
      if (item.status !== 'synced') {
        ids.add(payload.alert_id);
      }
    } catch { /* swallow */ }
  }
  return ids;
}

function outboxItemToLocalAlert(item: OutboxItem): WorkAlert | null {
  try {
    const payload = JSON.parse(item.payload) as OpenAlertInput;
    return {
      id: payload.alert_id,
      work_id: payload.work_id,
      created_by: '',
      severity: payload.severity as AlertSeverity,
      category: payload.category as AlertCategory,
      title: payload.title,
      description: payload.description,
      gps_lat: payload.gps_lat,
      gps_lng: payload.gps_lng,
      gps_accuracy_meters: payload.gps_accuracy_meters,
      status: 'open' as AlertStatus,
      field_resolution_at: null,
      field_resolution_notes: null,
      closed_by: null,
      closed_at: null,
      closure_notes: null,
      client_event_id: payload.client_event_id,
      created_at: item.created_at,
      updated_at: item.created_at,
      _localStatus: item.status,
    } as WorkAlert & { _localStatus: string };
  } catch {
    return null;
  }
}

export function mergeAlertsWithLocal(
  remote: WorkAlert[],
  localPending: WorkAlert[],
): WorkAlert[] {
  const remoteIds = new Set(remote.map((a) => a.client_event_id));
  const deduped = localPending.filter((a) => !remoteIds.has(a.client_event_id));
  return [...deduped, ...remote];
}

export function getAlertStatusLabel(status: AlertStatus): string {
  switch (status) {
    case 'open': return 'Aberto';
    case 'in_progress': return 'Em andamento';
    case 'resolved_in_field': return 'Resolvido em campo';
    case 'closed': return 'Encerrado';
  }
}

export function getAlertStatusColor(status: AlertStatus): { bg: string; fg: string } {
  switch (status) {
    case 'open': return { bg: '#fdecea', fg: '#7a1f17' };
    case 'in_progress': return { bg: '#fdf3d6', fg: '#7a5b00' };
    case 'resolved_in_field': return { bg: '#e3effc', fg: '#0a3a82' };
    case 'closed': return { bg: '#dff6e1', fg: '#1a6b2c' };
  }
}

export function getSeverityLabel(severity: AlertSeverity): string {
  switch (severity) {
    case 'low': return 'Baixa';
    case 'medium': return 'Media';
    case 'high': return 'Alta';
    case 'critical': return 'Critica';
  }
}

export function getSeverityColor(severity: AlertSeverity): { bg: string; fg: string; border: string } {
  switch (severity) {
    case 'low': return { bg: '#f3f6fb', fg: '#5a6473', border: '#e3e8ef' };
    case 'medium': return { bg: '#fdf3d6', fg: '#7a5b00', border: '#f0d060' };
    case 'high': return { bg: '#fdecea', fg: '#7a1f17', border: '#e8534a' };
    case 'critical': return { bg: '#d32f2f', fg: '#ffffff', border: '#b71c1c' };
  }
}

export function getCategoryLabel(category: AlertCategory): string {
  switch (category) {
    case 'accident': return 'Acidente';
    case 'material_shortage': return 'Falta de material';
    case 'safety': return 'Seguranca';
    case 'equipment': return 'Equipamento';
    case 'weather': return 'Clima';
    case 'other': return 'Outro';
  }
}

export function getUpdateTypeLabel(updateType: string): string {
  switch (updateType) {
    case 'opened': return 'Alerta aberto';
    case 'in_progress': return 'Em andamento';
    case 'resolved_in_field': return 'Resolvido em campo';
    case 'reopened': return 'Reaberto';
    case 'closed': return 'Encerrado';
    case 'comment': return 'Comentario';
    default: return updateType;
  }
}
