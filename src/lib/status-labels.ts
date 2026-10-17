export const PIPELINE_STATUSES = [
  'NEW',
  'REVIEW',
  'TO_APPLY',
  'APPLIED',
  'WAITING_RESULT',
  'CLOSED',
  'CANNOT_APPLY',
  'CANCELLED',
] as const;

export type PipelineStatusCode = (typeof PIPELINE_STATUSES)[number];

export const STATUS_LABELS: Record<PipelineStatusCode, string> = {
  NEW: 'Yeni',
  REVIEW: 'İnceleme',
  TO_APPLY: 'Başvurulacak',
  APPLIED: 'Başvuruldu',
  WAITING_RESULT: 'Sonuç bekleniyor',
  CLOSED: 'Kapandı',
  CANNOT_APPLY: 'Başvurulamaz',
  CANCELLED: 'İptal edildi',
};

/** Ana akış (iptal / başvurulamaz timeline dışında) */
export const TIMELINE_STEPS = [
  'REVIEW',
  'TO_APPLY',
  'APPLIED',
  'WAITING_RESULT',
  'CLOSED',
] as const satisfies readonly PipelineStatusCode[];

export function statusLabel(code: string): string {
  return STATUS_LABELS[code as PipelineStatusCode] ?? code;
}
