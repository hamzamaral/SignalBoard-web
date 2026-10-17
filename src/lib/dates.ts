export function fmtDate(v?: string | null) {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('tr-TR');
}

export function fmtRange(start?: string | null, end?: string | null) {
  if (!start && !end) return '—';
  return `${fmtDate(start)} – ${fmtDate(end)}`;
}
