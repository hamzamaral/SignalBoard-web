import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, getErrorMessage } from '@/lib/api';
import type { Listing } from '@/types/api';

export function ListingsPage({ kind = 'PUBLIC' }: { kind?: 'PUBLIC' | 'PRIVATE' }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['listings', kind],
    queryFn: async () =>
      (await api.get<{ items: Listing[] }>('/listings', { params: { kind, limit: 50 } })).data,
  });

  const track = useMutation({
    mutationFn: (listingId: string) => api.post('/pipeline', { listingId, status: 'REVIEW' }),
    onSuccess: () => {
      toast.success('Pipeline’a eklendi (hatırlatıcılar oluşturuldu)');
      void qc.invalidateQueries({ queryKey: ['pipeline'] });
      void qc.invalidateQueries({ queryKey: ['reminders'] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">
          {kind === 'PUBLIC' ? 'Kamu ilanları' : 'Özel ilanlar'}
        </h1>
        <p className="text-slate-600">
          {kind === 'PUBLIC'
            ? 'Kamu kaynaklarından toplanan / yapıştırılan ilanlar'
            : 'Özel sektör takip ekranı'}
        </p>
      </div>

      {isLoading && <p className="text-slate-500">Yükleniyor…</p>}
      <div className="space-y-3">
        {(data?.items ?? []).map((item) => (
          <article
            key={item.id}
            className="rounded-xl border border-slate-200 bg-white/80 p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{item.title}</h2>
                <p className="text-sm text-slate-600">
                  {item.institution?.name ?? 'Kurum yok'} · {item.city ?? 'Şehir yok'} ·{' '}
                  {item.source}
                  {item.possibleDup ? ' · olası tekrar' : ''}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Son başvuru:{' '}
                  {item.applyEndAt
                    ? new Date(item.applyEndAt).toLocaleDateString('tr-TR')
                    : '—'}
                  {item.kpssScoreType
                    ? ` · KPSS ${item.kpssScoreType} ≥ ${item.kpssMinScore ?? '?'}`
                    : ''}
                </p>
              </div>
              <div className="flex gap-2">
                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border px-3 py-1.5 text-sm"
                  >
                    Kaynak
                  </a>
                )}
                <button
                  type="button"
                  className="rounded-md bg-accent px-3 py-1.5 text-sm text-white"
                  onClick={() => track.mutate(item.id)}
                >
                  Takip et
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
