import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, getErrorMessage } from '@/lib/api';

const STATUSES = [
  'NEW',
  'REVIEW',
  'TO_APPLY',
  'APPLIED',
  'WAITING_RESULT',
  'CLOSED',
  'CANNOT_APPLY',
] as const;

type Row = {
  id: string;
  status: string;
  matchScore?: number | null;
  listing: { title: string; applyEndAt?: string | null };
};

export function PipelinePage() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['pipeline'],
    queryFn: async () => (await api.get<Row[]>('/pipeline')).data,
  });

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
        <h1 className="font-display text-3xl font-bold">Pipeline</h1>
        <p className="text-slate-600">Takip ettiğin ilanların durum akışı</p>
      </div>
      <div className="space-y-3">
        {(data ?? []).map((row) => (
          <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white/80 p-4">
            <div>
              <p className="font-medium">{row.listing.title}</p>
              <p className="text-xs text-slate-500">
                Skor: {row.matchScore ?? '—'} · Son:{' '}
                {row.listing.applyEndAt
                  ? new Date(row.listing.applyEndAt).toLocaleDateString('tr-TR')
                  : '—'}
              </p>
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
        ))}
      </div>
    </div>
  );
}
