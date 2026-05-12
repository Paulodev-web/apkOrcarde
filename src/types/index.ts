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
>;

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
  | { success: false; error: string };

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
  | 'record_pole_installation'
  | 'open_alert'
  | 'resolve_alert_in_field'
  | 'add_alert_comment'
  | 'mark_checklist_item';

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
