import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { api, getErrorMessage } from '@/lib/api';
import type { Listing } from '@/types/api';

export function ListingDetailPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['listing', id],
    enabled: Boolean(id),
    queryFn: async () => (await api.get<Listing>(`/listings/${id}`)).data,
  });

  const track = useMutation({
    mutationFn: (positionId?: string) =>
      api.post('/pipeline', { listingId: id, status: 'TO_APPLY', positionId }),
    onSuccess: () => {
      toast.success('Başvurularıma eklendi');
      void qc.invalidateQueries({ queryKey: ['pipeline'] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  if (isLoading || !data) return <p className="text-slate-500">Yükleniyor…</p>;

  return (
    <div className="space-y-6">
      <Link to="/listings" className="text-sm text-accent">
        ← Kamu ilanları
      </Link>
      <div>
        <h1 className="font-display text-3xl font-bold">{data.title}</h1>
        <p className="text-slate-600">
          {data.institution?.name ?? 'Kurum'} · {data.city ?? '—'} · {data.source}
        </p>
      </div>

      <div className="grid gap-3 rounded-xl border bg-white/80 p-4 text-sm sm:grid-cols-2">
        <p>
          <span className="text-slate-500">Başvuru:</span>{' '}
          {fmt(data.applyStartAt)} – {fmt(data.applyEndAt)}
        </p>
        <p>
          <span className="text-slate-500">Sınav:</span> {fmt(data.examAt)}
        </p>
        <p>
          <span className="text-slate-500">Sonuç ilanı:</span> {fmt(data.resultAnnounceAt)}
        </p>
        <p>
          <span className="text-slate-500">Yöntem:</span>{' '}
          {(data.applicationMethods ?? []).join(', ') || '—'}
        </p>
        {data.url && (
          <p className="sm:col-span-2">
            <a href={data.url} target="_blank" rel="noreferrer" className="text-accent">
              Kaynak linki
            </a>
          </p>
        )}
      </div>

      {(data.positions?.length ?? 0) > 0 && (
        <section className="rounded-xl border bg-white/80 p-4">
          <h2 className="mb-3 font-semibold">Kadrolar</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b text-slate-500">
                <tr>
                  <th className="py-2">#</th>
                  <th>Unvan</th>
                  <th>Sınıf</th>
                  <th>Derece</th>
                  <th>Adet</th>
                  <th>KPSS</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.positions!.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 align-top">
                    <td className="py-2">{p.sequenceNo}</td>
                    <td>
                      <div className="font-medium">{p.title}</div>
                      {p.educationRequirement && (
                        <div className="mt-1 max-w-md text-xs text-slate-500">
                          {p.educationRequirement}
                        </div>
                      )}
                    </td>
                    <td>{p.serviceClass ?? '—'}</td>
                    <td>{p.grade ?? '—'}</td>
                    <td>{p.quota ?? '—'}</td>
                    <td>
                      {p.kpssScoreType ?? '—'} ≥ {p.kpssMinScore ?? '?'}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="rounded-md bg-accent px-2 py-1 text-xs text-white"
                        onClick={() => track.mutate(p.id)}
                      >
                        Bu kadroyu takip et
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {(data.requiredDocuments?.length ?? 0) > 0 && (
        <section className="rounded-xl border bg-white/80 p-4">
          <h2 className="mb-2 font-semibold">İstenen belgeler</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
            {data.requiredDocuments!.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </section>
      )}

      {data.examTopics && (
        <section className="rounded-xl border bg-white/80 p-4">
          <h2 className="mb-2 font-semibold">Sınav konuları</h2>
          <pre className="whitespace-pre-wrap text-sm text-slate-700">{data.examTopics}</pre>
        </section>
      )}

      <button
        type="button"
        className="rounded-lg border px-4 py-2 text-sm"
        onClick={() => track.mutate(undefined)}
      >
        İlanı (genel) başvurularıma ekle
      </button>
    </div>
  );
}

function fmt(v?: string | null) {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('tr-TR');
}
