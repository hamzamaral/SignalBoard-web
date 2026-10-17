import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { api, getErrorMessage } from '@/lib/api';
import {
  PIPELINE_STATUSES,
  TIMELINE_STEPS,
  statusLabel,
  type PipelineStatusCode,
} from '@/lib/status-labels';
import type { PipelineRow } from '@/types/api';

export function PipelinePage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [deadlineOnly, setDeadlineOnly] = useState(false);
  const [q, setQ] = useState('');
  const [addedFrom, setAddedFrom] = useState('');
  const [addedTo, setAddedTo] = useState('');

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
    const needle = q.trim().toLowerCase();
    if (needle) {
      rows = rows.filter((r) => {
        const hay = [
          r.listing.title,
          r.listing.institution?.name,
          r.position?.title,
          r.notes,
          statusLabel(r.status),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return hay.includes(needle);
      });
    }
    if (deadlineOnly) {
      const in14 = Date.now() + 14 * 86400000;
      rows = rows.filter((r) => {
        const end = r.listing.applyEndAt ? new Date(r.listing.applyEndAt).getTime() : 0;
        return end > Date.now() && end <= in14;
      });
    }
    if (addedFrom) {
      const from = new Date(addedFrom).getTime();
      rows = rows.filter((r) => new Date(r.createdAt ?? 0).getTime() >= from);
    }
    if (addedTo) {
      const to = new Date(`${addedTo}T23:59:59`).getTime();
      rows = rows.filter((r) => new Date(r.createdAt ?? 0).getTime() <= to);
    }
    return rows;
  }, [data, deadlineOnly, q, addedFrom, addedTo]);

  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/pipeline/${id}`, { status }),
    onSuccess: () => {
      toast.success('Durum güncellendi');
      void qc.invalidateQueries({ queryKey: ['pipeline'] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/pipeline/${id}`),
    onSuccess: () => {
      toast.success('Başvurudan kaldırıldı');
      void qc.invalidateQueries({ queryKey: ['pipeline'] });
      void qc.invalidateQueries({ queryKey: ['listings'] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Başvurularım</h1>
        <p className="text-sm text-slate-600">
          Takip, arama, eklenme tarihi · silme · durum
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="block text-sm">
          <span className="mb-1 block text-slate-500">Ara</span>
          <input
            className="w-56 rounded border px-2 py-1.5 text-sm"
            placeholder="İlan / kurum / not…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-500">Durum</span>
          <select
            className="rounded border px-2 py-1.5 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Tümü</option>
            {PIPELINE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-500">Eklenme (bizden) ≥</span>
          <input
            type="date"
            className="rounded border px-2 py-1.5 text-sm"
            value={addedFrom}
            onChange={(e) => setAddedFrom(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-500">Eklenme ≤</span>
          <input
            type="date"
            className="rounded border px-2 py-1.5 text-sm"
            value={addedTo}
            onChange={(e) => setAddedTo(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-2 pb-1.5 text-sm">
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
              <div className="min-w-0 flex-1">
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
                  {' · '}
                  Eklenme:{' '}
                  {row.createdAt
                    ? new Date(row.createdAt).toLocaleDateString('tr-TR')
                    : '—'}
                </p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {TIMELINE_STEPS.map((step) => {
                    const idx = TIMELINE_STEPS.indexOf(step);
                    const cur = TIMELINE_STEPS.indexOf(
                      row.status as (typeof TIMELINE_STEPS)[number],
                    );
                    const active = cur >= 0 && idx <= cur;
                    return (
                      <span
                        key={step}
                        className={`rounded px-2 py-0.5 text-[10px] ${
                          active ? 'bg-accent text-white' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {statusLabel(step)}
                      </span>
                    );
                  })}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <select
                  className="rounded-md border px-2 py-1.5 text-sm"
                  value={row.status}
                  onChange={(e) => update.mutate({ id: row.id, status: e.target.value })}
                >
                  {PIPELINE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {statusLabel(s as PipelineStatusCode)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="text-xs text-red-600 underline"
                  onClick={() => {
                    if (confirm(`Başvurulardan kaldırılsın mı?\n${row.listing.title}`)) {
                      remove.mutate(row.id);
                    }
                  }}
                >
                  Sil
                </button>
              </div>
            </div>
          </article>
        ))}
        {!filtered.length && (
          <p className="text-sm text-slate-500">
            Kayıt yok veya filtreye uymuyor.{' '}
            <Link to="/listings" className="text-accent">
              Kamu ilanlarına git
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
