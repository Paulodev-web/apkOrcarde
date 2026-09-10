export type SendWorkMessageInput = {
  work_id: string;
  content: string | null;
  client_event_id: string;
  attachments: SendWorkMessageAttachment[];
};

export type SendWorkMessageAttachment = {
  id: string;
  file_type: 'image' | 'video' | 'audio' | 'document';
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  storage_path: string;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
};

export type SendWorkMessageOutput = {
  messageId: string;
  isNew: boolean;
};

// --- Bloco 3: Pole Installation RPC ---

export type RecordPoleInstallationMediaInput = {
  id: string;
  kind: 'image' | 'video';
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  storage_path: string;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  is_primary: boolean;
};

export type RecordPoleInstallationInput = {
  work_id: string;
  installation_id: string;
  x_coord: number;
  y_coord: number;
  gps_lat: number | null;
  gps_lng: number | null;
  gps_accuracy_meters: number | null;
  numbering: string | null;
  pole_type: string | null;
  notes: string | null;
  installed_at: string;
  client_event_id: string;
  media: RecordPoleInstallationMediaInput[];
};

export type RecordPoleInstallationOutput = {
  installationId: string;
  isNew: boolean;
};

// --- Bloco 4: Daily Log RPC ---

export type PublishDailyLogMediaInput = {
  id: string;
  kind: 'image' | 'video';
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  storage_path: string;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
};

export type PublishDailyLogInput = {
  work_id: string;
  log_date: string;
  daily_log_id: string;
  revision_id: string;
  crew_present: string[];
  activities: string;
  posts_installed_count: number;
  meters_installed: { BT: number; MT: number; rede: number };
  materials_consumed: MaterialConsumed[];
  incidents: string | null;
  rejection_reason: string | null;
  client_event_id: string;
  media: PublishDailyLogMediaInput[];
};

export type MaterialConsumed = {
  materialId: string;
  name: string;
  unit: string;
  quantity: number;
};

export type PublishDailyLogOutput = {
  dailyLogId: string;
  revisionId: string;
  revisionNumber: number;
  isNew: boolean;
};

// --- Bloco 5: Milestone RPC ---

export type ReportMilestoneMediaInput = {
  id: string;
  kind: 'image' | 'video';
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  storage_path: string;
  width: number | null;
  height: number | null;
};

export type ReportMilestoneInput = {
  work_id: string;
  milestone_id: string;
  event_id: string;
  notes: string | null;
  client_event_id: string;
  media: ReportMilestoneMediaInput[];
};

export type ReportMilestoneOutput = {
  eventId: string;
  isNew: boolean;
};

// --- Bloco 6: Checklist RPC ---

export type MarkChecklistItemMediaInput = {
  id: string;
  kind: 'image' | 'video';
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  storage_path: string;
  width: number | null;
  height: number | null;
};

export type MarkChecklistItemInput = {
  work_id: string;
  checklist_id: string;
  item_id: string;
  is_completed: boolean;
  notes: string | null;
  client_event_id: string;
  media: MarkChecklistItemMediaInput[];
};

export type MarkChecklistItemOutput = {
  itemId: string;
  isNew: boolean;
};

// --- Bloco 7: Alert RPCs ---

export type OpenAlertMediaInput = {
  id: string;
  kind: 'image' | 'video';
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  storage_path: string;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
};

export type OpenAlertInput = {
  work_id: string;
  alert_id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  title: string;
  description: string;
  gps_lat: number | null;
  gps_lng: number | null;
  gps_accuracy_meters: number | null;
  client_event_id: string;
  media: OpenAlertMediaInput[];
};

export type OpenAlertOutput = {
  alertId: string;
  isNew: boolean;
};

export type ResolveAlertMediaInput = {
  id: string;
  kind: 'image' | 'video';
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  storage_path: string;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
};

export type ResolveAlertInput = {
  work_id: string;
  alert_id: string;
  resolution_notes: string;
  client_event_id: string;
  media: ResolveAlertMediaInput[];
};

export type ResolveAlertOutput = {
  updateId: string;
  isNew: boolean;
};

export type AddAlertCommentMediaInput = {
  id: string;
  kind: 'image' | 'video';
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  storage_path: string;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
};

export type AddAlertCommentInput = {
  work_id: string;
  alert_id: string;
  notes: string;
  client_event_id: string;
  media: AddAlertCommentMediaInput[];
};

export type AddAlertCommentOutput = {
  updateId: string;
  isNew: boolean;
};

// --- Equipamento montado no poste ---

export type RecordPoleEquipmentItemInput = {
  material_id: string | null;
  label: string;
  quantity: number;
  /** false = montou algo que nao estava no projeto. O engenheiro precisa ver. */
  from_project: boolean;
};

export type RecordPoleEquipmentMediaInput = {
  kind: 'image' | 'video';
  storage_path: string;
  mime_type: string;
  file_name: string;
  file_size_bytes: number;
  is_primary: boolean;
};

export type RecordPoleEquipmentInput = {
  work_id: string;
  equipment_id: string;
  installation_id: string;
  notes: string | null;
  installed_at: string;
  client_event_id: string;
  items: RecordPoleEquipmentItemInput[];
  media: RecordPoleEquipmentMediaInput[];
};

export type RecordPoleEquipmentOutput = {
  equipmentId: string;
  isNew: boolean;
};

// --- Trecho de rede lancado ---

export type RecordNetworkSpanInput = {
  work_id: string;
  span_id: string;
  connection_id: string | null;
  from_post_id: string | null;
  to_post_id: string | null;
  category: 'BT' | 'MT' | 'iluminacao';
  meters: number;
  meters_planned: number | null;
  cable_type: string | null;
  notes: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
  installed_at: string;
  client_event_id: string;
  media: RecordPoleEquipmentMediaInput[];
};

export type RecordNetworkSpanOutput = {
  spanId: string;
  isNew: boolean;
};
