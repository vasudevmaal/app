export function isExportLocked(kind: string, paid: boolean, format: string, quality: number) {
  if (!['3d-text', '3d'].includes(kind) || paid) return false;
  return kind === '3d'
    ? !(format === 'png' && quality === 1024)
    : !((format === 'png' && quality === 1280) ||
      (format === 'gif' && (quality === 480 || quality === 768)));
}
