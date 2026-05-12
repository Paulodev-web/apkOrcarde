export function chatMediaPath(workId: string, messageId: string, fileUuid: string, ext: string): string {
  return `${workId}/chat/${messageId}/${fileUuid}.${normalizeExt(ext)}`;
}

export function dailyLogMediaPath(
  workId: string,
  dailyLogId: string,
  revisionId: string,
  fileUuid: string,
  ext: string,
): string {
  return `${workId}/daily-logs/${dailyLogId}/${revisionId}/${fileUuid}.${normalizeExt(ext)}`;
}

export function milestoneMediaPath(
  workId: string,
  milestoneId: string,
  eventId: string,
  fileUuid: string,
  ext: string,
): string {
  return `${workId}/milestones/${milestoneId}/${eventId}/${fileUuid}.${normalizeExt(ext)}`;
}

export function poleInstallationMediaPath(
  workId: string,
  installationId: string,
  fileUuid: string,
  ext: string,
): string {
  return `${workId}/pole-installations/${installationId}/${fileUuid}.${normalizeExt(ext)}`;
}

export function checklistItemMediaPath(
  workId: string,
  checklistId: string,
  itemId: string,
  fileUuid: string,
  ext: string,
): string {
  return `${workId}/checklists/${checklistId}/${itemId}/${fileUuid}.${normalizeExt(ext)}`;
}

export function alertMediaPath(workId: string, alertId: string, fileUuid: string, ext: string): string {
  return `${workId}/alerts/${alertId}/${fileUuid}.${normalizeExt(ext)}`;
}

export function projectPdfPath(workId: string): string {
  return `${workId}/project/projeto.pdf`;
}

function normalizeExt(ext: string): string {
  return ext.replace(/^\./, '').toLowerCase();
}
