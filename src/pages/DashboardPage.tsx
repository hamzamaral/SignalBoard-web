import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { api, getErrorMessage } from '@/lib/api';
import type { Listing } from '@/types/api';

type RecItem = { listing: Listing; score: number; reasons: string[] };

export function DashboardPage() {
  const qc = useQueryClient();
  const recs = useQuery({
    queryKey: ['recommendations'],
    queryFn: async () =>
      (await api.get<{ items: RecItem[] }>('/recommendations', { params: { limit: 12 } })).data,
  });
  const reminders = useQuery({
    queryKey: ['reminders'],
    queryFn: async () =>
      (await api.get('/reminders')).data as Array<{ id: string; title: string; remindAt: string }>,
  });

  const track = useMutation({
    mutationFn: (listingId: string) =>
      api.post('/pipeline', { listingId, status: 'TO_APPLY' }),
    onSuccess: () => {
      toast.success('Başvurularıma eklendi');
      void qc.invalidateQueries({ queryKey: ['pipeline'] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <div className="space-y-8">
      <section>
        <h1 className="font-display text-3xl font-bold">Özet</h1>
        <p className="mt-1 text-slate-600">Profiline uyan ilanlar ve yaklaşan hatırlatıcılar</p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white/80 p-5">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="font-semibold">Önerilen ilanlar</h2>
            <Link to="/listings" className="text-sm text-accent">
              Kamu listesi
            </Link>
          </div>
          <p className="mb-3 text-xs text-slate-500">
            Profiline göre skorlanan açık ilanlar (en fazla 12)
          </p>
          <ul className="space-y-3">
            {(recs.data?.items ?? []).map((item) => (
              <li key={item.listing.id} className="rounded-lg bg-panel px-3 py-2">
                <div className="flex justify-between gap-2">
                  <Link
                    to={`/listings/${item.listing.id}`}
                    className="font-medium hover:text-accent"
                  >
                    {item.listing.title}
                  </Link>
                  <span className="shrink-0 text-sm text-accent">Skor {item.score}</span>
                </div>
                <p className="text-xs text-slate-500">{item.reasons.slice(0, 2).join(' · ')}</p>
                <div className="mt-2 flex gap-3 text-xs">
                  <Link to={`/listings/${item.listing.id}`} className="text-accent underline">
                    Detay
                  </Link>
                  <button
                    type="button"
                    className="text-accent underline"
                    onClick={() => track.mutate(item.listing.id)}
                  >
                    Başvurularıma ekle
                  </button>
                </div>
              </li>
            ))}
            {!recs.isLoading && !(recs.data?.items?.length) && (
              <li className="text-sm text-slate-500">
                Henüz eşleşme yok —{' '}
                <Link to="/profile" className="text-accent underline">
                  Profilini doldur
                </Link>{' '}
                → öneriler gelir.
              </li>
            )}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white/80 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Hatırlatıcılar</h2>
            <Link to="/reminders" className="text-sm text-accent">
              Takvime git
            </Link>
          </div>
          <ul className="space-y-3">
            {(reminders.data ?? []).slice(0, 5).map((r) => (
              <li key={r.id} className="rounded-lg bg-panel px-3 py-2 text-sm">
                <p className="font-medium">{r.title}</p>
                <p className="text-slate-500">{new Date(r.remindAt).toLocaleString('tr-TR')}</p>
              </li>
            ))}
            {!reminders.isLoading && !(reminders.data?.length) && (
              <li className="text-sm text-slate-500">Aktif hatırlatıcı yok.</li>
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}
