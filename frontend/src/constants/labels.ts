export const STATUS_LABELS: Record<string, string> = {
  PRESENT: 'Hadir',
  SICK: 'Sakit',
  EXCUSED: 'Izin',
  ABSENT: 'Alfa',
  DISPEN: 'Dispensasi',
  SKIPPED: 'Tidak Diisi',
};

export const AGENDA_TYPE_LABELS: Record<string, string> = {
  pembelajaran: 'Pembelajaran',
  gp: 'Guru Piket',
  rapat: 'Rapat',
  piket: 'Piket',
  ekstrakurikuler: 'Ekstrakurikuler',
  ulangan: 'Ulangan',
  uts: 'UTS',
  uas: 'UAS',
};

export function labelOf(map: Record<string, string>, code: string | null | undefined, fallback?: string): string {
  if (!code) return fallback ?? '';
  const direct = map[code];
  if (direct) return direct;
  const lower = map[code.toLowerCase()];
  if (lower) return lower;
  // Fallback: title-case the raw value so free-text codes stay readable.
  return fallback ?? code
    .split(/[\s-]+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ');
}

export function statusLabel(code: string | null | undefined): string {
  return labelOf(STATUS_LABELS, code, code ?? '');
}

export function agendaTypeLabel(code: string | null | undefined): string {
  return labelOf(AGENDA_TYPE_LABELS, code, code ?? '');
}
