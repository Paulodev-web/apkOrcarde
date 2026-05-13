export type WorkStatus = 'planned' | 'in_progress' | 'paused' | 'completed' | 'cancelled';

export type ProfileRole = 'engineer' | 'manager';

export type Work = {
  id: string;
  engineer_id: string;
  manager_id: string | null;
  name: string;
  client_name: string;
  status: WorkStatus;
  address: string | null;
  started_at: string | null;
  expected_end_at: string | null;
  completed_at: string | null;
  last_activity_at: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: ProfileRole;
  is_active: boolean;
};

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export type OutboxStatus =
  | 'pending'
  | 'uploading_media'
  | 'calling_rpc'
  | 'synced'
  | 'failed';

export type OutboxActionType =
  | 'send_message'
  | 'publish_daily_log'
  | 'report_milestone'
  | 'set_milestone_in_progress'
  | 'record_pole_installation'
  | 'open_alert'
  | 'resolve_alert_in_field'
  | 'add_alert_comment'
  | 'mark_checklist_item'
  | 'set_checklist_in_progress';

export type OutboxItem = {
  id: number;
  client_event_id: string;
  action_type: OutboxActionType | string;
  payload: string;
  media_paths: string | null;
  status: OutboxStatus;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  created_at: string;
  synced_at: string | null;
  next_retry_at: string | null;
  status_updated_at?: string | null;
};

export type EnqueueOutboxInput = {
  client_event_id: string;
  action_type: OutboxActionType | string;
  payload: Record<string, unknown> | string;
  media_paths?: string[];
  max_attempts?: number;
};

export type SessionUser = {
  id: string;
  email: string;
  fullName: string;
};

export type WorkMessage = {
  id: string;
  work_id: string;
  sender_id: string;
  content: string | null;
  client_event_id: string | null;
  created_at: string;
  read_by_engineer_at: string | null;
  read_by_manager_at: string | null;
  work_message_attachments: WorkMessageAttachment[];
};

export type WorkMessageAttachment = {
  id: string;
  message_id: string;
  file_type: 'image' | 'video' | 'audio' | 'document';
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  storage_path: string;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  created_at: string;
};

export type MediaAsset = {
  uri: string;
  type: 'image' | 'video' | 'audio';
  fileName: string;
  mimeType: string;
  fileSize: number;
  width?: number;
  height?: number;
  durationSeconds?: number;
};

// --- Bloco 3: Poles ---

export type PoleInstallationStatus = 'installed' | 'removed';

export type WorkPoleInstallation = {
  id: string;
  work_id: string;
  created_by: string;
  x_coord: number;
  y_coord: number;
  gps_lat: number | null;
  gps_lng: number | null;
  gps_accuracy_meters: number | null;
  numbering: string | null;
  pole_type: string | null;
  notes: string | null;
  installed_at: string;
  status: PoleInstallationStatus;
  removed_at: string | null;
  removed_by: string | null;
  client_event_id: string;
  created_at: string;
  work_pole_installation_media?: WorkPoleInstallationMedia[];
};

export type WorkPoleInstallationMedia = {
  id: string;
  installation_id: string;
  work_id: string;
  kind: 'image' | 'video';
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  is_primary: boolean;
  created_at: string;
};

export type WorkProjectPost = {
  id: string;
  work_id: string;
  source_post_id: string | null;
  numbering: string | null;
  post_type: string | null;
  x_coord: number;
  y_coord: number;
  metadata: Record<string, unknown> | null;
};

export type WorkProjectSnapshot = {
  work_id: string;
  pdf_storage_path: string | null;
  pdf_num_pages: number | null;
  materials_planned: PlannedMaterial[] | null;
  meters_planned: MetersPlanned | null;
};

export type PlannedMaterial = {
  materialId: string;
  name: string;
  unit: string;
  quantity: number;
};

export type MetersPlanned = {
  BT: number;
  MT: number;
  rede: number;
};

// --- Bloco 4: Daily Log ---

export type DailyLogStatus = 'pending_approval' | 'approved' | 'rejected';

export type WorkDailyLog = {
  id: string;
  work_id: string;
  log_date: string;
  published_by: string;
  current_revision_id: string | null;
  status: DailyLogStatus;
  approved_by: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  created_at: string;
  updated_at: string;
  work_daily_log_revisions?: WorkDailyLogRevision[];
};

export type WorkDailyLogRevision = {
  id: string;
  daily_log_id: string;
  revision_number: number;
  crew_present: string[];
  activities: string;
  posts_installed_count: number;
  meters_installed: { BT: number; MT: number; rede: number } | null;
  materials_consumed: import('./rpc').MaterialConsumed[] | null;
  incidents: string | null;
  rejection_reason: string | null;
  client_event_id: string;
  created_at: string;
  work_daily_log_media?: WorkDailyLogMedia[];
};

export type WorkDailyLogMedia = {
  id: string;
  revision_id: string;
  daily_log_id: string;
  work_id: string;
  kind: 'image' | 'video';
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  created_at: string;
};

export type WorkTeamMember = {
  id: string;
  work_id: string;
  name: string;
  role: string | null;
  is_active: boolean;
};

export type CrewMember = {
  id: string;
  team_id: string;
  name: string;
  role: string | null;
  is_active: boolean;
};

export type PoleMarkerKind = 'planned' | 'installed' | 'pending' | 'failed';

export type PoleMarker = {
  id: string;
  kind: PoleMarkerKind;
  x_coord: number;
  y_coord: number;
  numbering: string | null;
  pole_type: string | null;
};

// --- Bloco 5: Milestones ---

export type MilestoneStatus =
  | 'pending'
  | 'in_progress'
  | 'awaiting_approval'
  | 'approved'
  | 'rejected';

export type MilestoneCode =
  | 'locacao'
  | 'postes_instalados'
  | 'cabeamento_bt'
  | 'cabeamento_mt'
  | 'energizacao'
  | 'comissionamento';

export type WorkMilestone = {
  id: string;
  work_id: string;
  code: MilestoneCode;
  name: string;
  order_index: number;
  status: MilestoneStatus;
  reported_by: string | null;
  reported_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  work_milestone_events?: WorkMilestoneEvent[];
};

export type WorkListMilestoneRow = Pick<
  WorkMilestone,
  'id' | 'code' | 'name' | 'order_index' | 'status'
>;

export type WorkListItem = Pick<
  Work,
  | 'id'
  | 'name'
  | 'client_name'
  | 'status'
  | 'last_activity_at'
  | 'address'
  | 'started_at'
  | 'expected_end_at'
> & {
  work_milestones?: WorkListMilestoneRow[];
  planned_posts?: { count: number }[];
  pole_installations?: { count: number }[];
};

export type MilestoneEventType = 'reported' | 'approved' | 'rejected' | 'reset';

export type WorkMilestoneEvent = {
  id: string;
  milestone_id: string;
  work_id: string;
  event_type: MilestoneEventType;
  actor_id: string;
  actor_role: 'engineer' | 'manager';
  notes: string | null;
  client_event_id: string | null;
  created_at: string;
  work_milestone_event_media?: WorkMilestoneEventMedia[];
};

export type WorkMilestoneEventMedia = {
  id: string;
  event_id: string;
  kind: 'image' | 'video';
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  created_at: string;
};

// --- Bloco 6: Checklists ---

export type ChecklistStatus =
  | 'pending'
  | 'in_progress'
  | 'awaiting_validation'
  | 'validated'
  | 'returned';

export type WorkChecklist = {
  id: string;
  work_id: string;
  name: string;
  description: string | null;
  assigned_by: string;
  assigned_to: string;
  due_date: string | null;
  status: ChecklistStatus;
  return_reason: string | null;
  validated_at: string | null;
  returned_at: string | null;
  created_at: string;
  updated_at: string;
  work_checklist_items?: WorkChecklistItem[];
};

export type WorkChecklistItem = {
  id: string;
  work_checklist_id: string;
  order_index: number;
  label: string;
  description: string | null;
  requires_photo: boolean;
  is_completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
  notes: string | null;
  client_event_id: string | null;
  created_at: string;
  updated_at: string;
  work_checklist_item_media?: WorkChecklistItemMedia[];
};

export type WorkChecklistItemMedia = {
  id: string;
  item_id: string;
  kind: 'image' | 'video';
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  created_at: string;
};

// --- Bloco 7: Alerts ---

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

export type AlertCategory =
  | 'accident'
  | 'material_shortage'
  | 'safety'
  | 'equipment'
  | 'weather'
  | 'other';

export type AlertStatus = 'open' | 'in_progress' | 'resolved_in_field' | 'closed';

export type AlertUpdateType =
  | 'opened'
  | 'in_progress'
  | 'resolved_in_field'
  | 'reopened'
  | 'closed'
  | 'comment';

export type WorkAlert = {
  id: string;
  work_id: string;
  created_by: string;
  severity: AlertSeverity;
  category: AlertCategory;
  title: string;
  description: string;
  gps_lat: number | null;
  gps_lng: number | null;
  gps_accuracy_meters: number | null;
  status: AlertStatus;
  field_resolution_at: string | null;
  field_resolution_notes: string | null;
  closed_by: string | null;
  closed_at: string | null;
  closure_notes: string | null;
  client_event_id: string;
  created_at: string;
  updated_at: string;
};

export type WorkAlertUpdate = {
  id: string;
  alert_id: string;
  work_id: string;
  actor_id: string;
  actor_role: 'engineer' | 'manager';
  update_type: AlertUpdateType;
  notes: string | null;
  client_event_id: string | null;
  created_at: string;
};

// --- Bloco 8: Notifications ---

export type NotificationKind =
  | 'message_received'
  | 'daily_log_approved'
  | 'daily_log_rejected'
  | 'milestone_approved'
  | 'milestone_rejected'
  | 'checklist_validated'
  | 'checklist_returned'
  | 'alert_closed'
  | 'pole_installed';

export type AppNotification = {
  id: string;
  user_id: string;
  work_id: string | null;
  kind: NotificationKind;
  title: string;
  body: string;
  link_path: string | null;
  is_read: boolean;
  created_at: string;
};

export type WorkAlertMedia = {
  id: string;
  alert_id: string;
  work_id: string;
  kind: 'image' | 'video';
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  created_at: string;
};
