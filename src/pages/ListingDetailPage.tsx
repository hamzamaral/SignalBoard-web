import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { api, getErrorMessage } from '@/lib/api';
import type { Listing } from '@/types/api';

export function ListingDetailPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [notes, setNotes] = useState('');
  const [enrichText, setEnrichText] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['listing', id],
    enabled: Boolean(id),
    queryFn: async () => (await api.get<Listing>(`/listings/${id}`)).data,
  });

  useEffect(() => {
    setNotes(data?.myTracking?.notes ?? '');
  }, [data?.myTracking?.notes, data?.id]);

  const track = useMutation({
    mutationFn: (positionId?: string) =>
      api.post('/pipeline', { listingId: id, status: 'TO_APPLY', positionId }),
    onSuccess: () => {
      toast.success('Başvurularıma eklendi');
      void qc.invalidateQueries({ queryKey: ['pipeline'] });
      void qc.invalidateQueries({ queryKey: ['listing', id] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const saveNotes = useMutation({
    mutationFn: async () => {
      if (data?.myTracking?.id) {
        return api.patch(`/pipeline/${data.myTracking.id}`, { notes });
      }
      return api.post('/pipeline', { listingId: id, status: 'REVIEW', notes });
    },
    onSuccess: () => {
      toast.success('Not kaydedildi');
      void qc.invalidateQueries({ queryKey: ['listing', id] });
      void qc.invalidateQueries({ queryKey: ['pipeline'] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const enrich = useMutation({
    mutationFn: () =>
      api.post(`/listings/${id}/enrich`, {
        text: enrichText.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('AI / kurallar ile alanlar güncellendi');
      setEnrichText('');
      void qc.invalidateQueries({ queryKey: ['listing', id] });
      void qc.invalidateQueries({ queryKey: ['listings'] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  if (isLoading || !data) return <p className="text-slate-500">Yükleniyor…</p>;

  const thin =
    !data.applyStartAt &&
    !data.applyEndAt &&
    !data.examAt &&
    !(data.positions?.length) &&
    !(data.requiredDocuments?.length);

  const backTo = data.kind === 'PRIVATE' ? '/private' : '/listings';

  return (
    <div className="space-y-6">
      <Link to={backTo} className="text-sm text-accent">
        ← {data.kind === 'PRIVATE' ? 'Özel ilanlar' : 'Kamu ilanları'}
      </Link>
      <div>
        <h1 className="font-display text-3xl font-bold">{data.title}</h1>
        <p className="text-slate-600">
          {data.institution?.name ?? 'Kurum'} · {data.city ?? 'Şehir yok'} ·{' '}
          {sourceLabel(data.source)}
          {data.createdAt
            ? ` · Eklenme: ${new Date(data.createdAt).toLocaleDateString('tr-TR')}`
            : ''}
        </p>
      </div>

      {thin && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-950">
          <p className="font-medium">Bu kayıt özet scrape</p>
          <p className="mt-1 text-amber-900/80">
            Aşağıdaki AI kutusuna ilan metnini yapıştırıp doldurabilirsin.
          </p>
        </div>
      )}

      <div className="grid gap-3 rounded-xl border bg-white/80 p-4 text-sm sm:grid-cols-2">
        <p>
          <span className="text-slate-500">Başvuru:</span>{' '}
          {hasDate(data.applyStartAt, data.applyEndAt)
            ? `${fmt(data.applyStartAt)} – ${fmt(data.applyEndAt)}`
            : 'Henüz yok (özet kayıt)'}
        </p>
        <p>
          <span className="text-slate-500">Sınav:</span>{' '}
          {data.examAt ? fmt(data.examAt) : 'Henüz yok'}
        </p>
        <p>
          <span className="text-slate-500">Sonuç ilanı:</span>{' '}
          {data.resultAnnounceAt ? fmt(data.resultAnnounceAt) : 'Henüz yok'}
        </p>
        <p>
          <span className="text-slate-500">Yöntem:</span>{' '}
          {(data.applicationMethods ?? []).join(', ') || 'Henüz yok'}
        </p>
        {data.url && (
          <p className="sm:col-span-2">
            <a
              href={data.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex rounded-md bg-accent px-3 py-2 text-sm text-white"
            >
              Kaynak sayfasını aç
            </a>
          </p>
        )}
      </div>

      <section className="rounded-xl border bg-white/80 p-4">
        <h2 className="font-semibold">Özel notlarım</h2>
        <p className="mt-1 text-xs text-slate-500">Sadece senin başvurunda görünür.</p>
        <textarea
          className="mt-2 min-h-24 w-full rounded border p-3 text-sm"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Örn. KPSS uygun, belge eksik, mail atıldı…"
        />
        <button
          type="button"
          className="mt-2 rounded bg-accent px-3 py-1.5 text-sm text-white"
          onClick={() => saveNotes.mutate()}
          disabled={saveNotes.isPending}
        >
          Notu kaydet
        </button>
      </section>

      <section className="rounded-xl border bg-white/80 p-4">
        <h2 className="font-semibold">AI ile alan doldur</h2>
        <p className="mt-1 text-xs text-slate-500">
          İlan metnini yapıştır (veya boş bırakıp mevcut özet metni kullan). Kurallar + LLM tarih /
          kadro / belge alanlarını doldurur.
        </p>
        <textarea
          className="mt-2 min-h-32 w-full rounded border p-3 text-sm"
          value={enrichText}
          onChange={(e) => setEnrichText(e.target.value)}
          placeholder="Resmi ilan metnini buraya yapıştır…"
        />
        <button
          type="button"
          className="mt-2 rounded bg-accent px-3 py-1.5 text-sm text-white disabled:opacity-50"
          onClick={() => enrich.mutate()}
          disabled={enrich.isPending}
        >
          {enrich.isPending ? 'İşleniyor…' : 'AI / kurallar ile doldur'}
        </button>
      </section>

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

      {showExamTopics(data.examTopics) && (
        <section className="rounded-xl border bg-white/80 p-4">
          <h2 className="mb-2 font-semibold">Sınav konuları</h2>
          <pre className="whitespace-pre-wrap text-sm text-slate-700">
            {stripExamHeading(data.examTopics!)}
          </pre>
        </section>
      )}

      <button
        type="button"
        className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white"
        onClick={() => track.mutate(undefined)}
      >
        Başvurularıma ekle
      </button>
    </div>
  );
}

function fmt(v?: string | null) {
  if (!v) return '—';
  return new Date(v).toLocaleDateString('tr-TR');
}

function hasDate(a?: string | null, b?: string | null) {
  return Boolean(a || b);
}

function sourceLabel(source: string) {
  const map: Record<string, string> = {
    KAMUILAN: 'Kamu İlan (SBB)',
    ILAN_GOV: 'ilan.gov.tr',
    YEREL_YONETIMLER: 'Yerel Yönetimler',
    MANUAL: 'Manuel / yapıştırma',
    PRIVATE: 'Özel',
  };
  return map[source] ?? source;
}

function stripExamHeading(t: string) {
  return t.replace(/^Sınav\s*Konuları\s*[;:.\-–]?\s*/i, '').trim();
}

function showExamTopics(t?: string | null) {
  if (!t || t.trim().length < 20) return false;
  if (/["'][A-Za-zÇĞİÖŞÜçğıöşü]?$/.test(t.trim())) return false;
  return true;
}
