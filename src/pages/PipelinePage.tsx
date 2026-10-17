import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { api, getErrorMessage } from '@/lib/api';
import type { PipelineRow } from '@/types/api';

const STATUSES = [
  'NEW',
  'REVIEW',
  'TO_APPLY',
  'APPLIED',
  'WAITING_RESULT',
  'CLOSED',
  'CANNOT_APPLY',
] as const;

const TIMELINE = ['REVIEW', 'TO_APPLY', 'APPLIED', 'WAITING_RESULT', 'CLOSED'] as const;

export function PipelinePage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [deadlineOnly, setDeadlineOnly] = useState(false);

  const { data } = useQuery({
    queryKey: ['pipeline', statusFilter],
    queryFn: async () =>
      (
        await api.get<PipelineRow[]>('/pipeline', {
          params: statusFilter ? { status: statusFilter } : undefined,
        })
      ).data,
  });

  const filtered = useMemo(() => {
    let rows = data ?? [];
    if (deadlineOnly) {
      const in14 = Date.now() + 14 * 86400000;
      rows = rows.filter((r) => {
        const end = r.listing.applyEndAt ? new Date(r.listing.applyEndAt).getTime() : 0;
        return end > Date.now() && end <= in14;
      });
    }
    return rows;
  }, [data, deadlineOnly]);

  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/pipeline/${id}`, { status }),
    onSuccess: () => {
      toast.success('Durum güncellendi');
      void qc.invalidateQueries({ queryKey: ['pipeline'] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Başvurularım</h1>
        <p className="text-slate-600">Takip ettiğin ilanlar, seçilen kadro ve durum zaman çizelgesi</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          className="rounded-md border px-2 py-1.5 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Tüm durumlar</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={deadlineOnly}
            onChange={(e) => setDeadlineOnly(e.target.checked)}
          />
          14 gün içinde bitenler
        </label>
      </div>

      <div className="space-y-3">
        {filtered.map((row) => (
          <article key={row.id} className="rounded-xl border bg-white/80 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Link to={`/listings/${row.listing.id}`} className="font-medium hover:text-accent">
                  {row.listing.title}
                </Link>
                <p className="text-xs text-slate-500">
                  {row.listing.institution?.name ?? '—'}
                  {row.position ? ` · Kadro: ${row.position.title}` : ''}
                  {row.matchScore != null ? ` · Skor: ${row.matchScore}` : ''}
                  {row.updatedFlag ? ' · güncellendi' : ''}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Başvuru sonu:{' '}
                  {row.listing.applyEndAt
                    ? new Date(row.listing.applyEndAt).toLocaleDateString('tr-TR')
                    : '—'}
                  {row.listing.examAt
                    ? ` · Sınav: ${new Date(row.listing.examAt).toLocaleDateString('tr-TR')}`
                    : ''}
                </p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {TIMELINE.map((step) => {
                    const idx = TIMELINE.indexOf(step);
                    const cur = TIMELINE.indexOf(row.status as (typeof TIMELINE)[number]);
                    const active = cur >= 0 && idx <= cur;
                    return (
                      <span
                        key={step}
                        className={`rounded px-2 py-0.5 text-[10px] ${
                          active ? 'bg-accent text-white' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {step}
                      </span>
                    );
                  })}
                </div>
                {(row.listing.requiredDocuments?.length ?? 0) > 0 && (
                  <p className="mt-2 text-xs text-slate-500">
                    Belgeler: {row.listing.requiredDocuments!.slice(0, 3).join(', ')}
                    {(row.listing.requiredDocuments!.length ?? 0) > 3 ? '…' : ''}
                  </p>
                )}
              </div>
              <select
                className="rounded-md border px-2 py-1.5 text-sm"
                value={row.status}
                onChange={(e) => update.mutate({ id: row.id, status: e.target.value })}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </article>
        ))}
        {!filtered.length && (
          <p className="text-sm text-slate-500">Henüz başvuru/takip kaydı yok.</p>
        )}
      </div>
    </div>
  );
}
