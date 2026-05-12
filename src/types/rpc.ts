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
