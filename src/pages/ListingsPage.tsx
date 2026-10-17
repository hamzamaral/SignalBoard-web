import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/features/auth/AuthContext';
import { api, getErrorMessage } from '@/lib/api';
import { fmtDate, fmtRange } from '@/lib/dates';
import { downloadXlsx } from '@/lib/excel';
import { statusLabel } from '@/lib/status-labels';
import type { Listing } from '@/types/api';

export function ListingsPage({ kind = 'PUBLIC' }: { kind?: 'PUBLIC' | 'PRIVATE' }) {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const isAdmin = hasRole('ADMIN');
  const [q, setQ] = useState('');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['listings', kind, q, createdFrom, createdTo],
    queryFn: async () =>
      (
        await api.get<{ items: Listing[] }>('/listings', {
          params: {
            kind,
            limit: 200,
            q: q.trim() || undefined,
            createdFrom: createdFrom || undefined,
            createdTo: createdTo || undefined,
          },
        })
      ).data,
  });

  const items = data?.items ?? [];

  const track = useMutation({
    mutationFn: (listingId: string) => api.post('/pipeline', { listingId, status: 'REVIEW' }),
    onSuccess: () => {
      toast.success('Takibe eklendi');
      void qc.invalidateQueries({ queryKey: ['listings'] });
      void qc.invalidateQueries({ queryKey: ['pipeline'] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const removeListing = useMutation({
    mutationFn: (id: string) => api.delete(`/listings/${id}`),
    onSuccess: () => {
      toast.success('İlan silindi');
      void qc.invalidateQueries({ queryKey: ['listings'] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const patchTrack = useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string;
      mailOk?: boolean;
      formOk?: boolean;
      applyChannel?: string;
      status?: string;
    }) => api.patch(`/pipeline/${id}`, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['listings'] }),
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const ensureTrack = useMutation({
    mutationFn: (listingId: string) =>
      api.post('/pipeline', {
        listingId,
        status: 'TO_APPLY',
        applyChannel: 'kariyer.net',
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['listings'] }),
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  function exportExcel() {
    if (kind === 'PUBLIC') {
      downloadXlsx(
        'kamu-ilanlar.xlsx',
        items.map((row) => ({
          İlan: row.title,
          Pozisyon: row.position || row.positions?.[0]?.title || '',
          'Başvuru başlangıç': row.applyStartAt ? fmtDate(row.applyStartAt) : '',
          'Başvuru bitiş': row.applyEndAt ? fmtDate(row.applyEndAt) : '',
          Açıklanma: row.resultAnnounceAt ? fmtDate(row.resultAnnounceAt) : '',
          Kontrol: row.myTracking?.updatedFlag ? 'Güncellendi' : row.myTracking ? 'Takipte' : '',
          İşlem: row.myTracking ? statusLabel(row.myTracking.status) : '',
          'İlan tarihi': fmtRange(row.applyStartAt, row.applyEndAt),
          'Eklenme (biz)': row.createdAt ? fmtDate(row.createdAt) : '',
          URL: row.url ?? '',
        })),
        'Kamu',
      );
    } else {
      downloadXlsx(
        'ozel-firmalar.xlsx',
        items.map((row) => ({
          Firma: row.institution?.name ?? row.title,
          Başvuru: row.myTracking?.applyChannel ?? '',
          Mail: row.myTracking?.mailOk ? 'ok' : '',
          'İletişim formu': row.myTracking?.formOk ? 'ok' : '',
          Pozisyon: row.position ?? '',
          URL: row.url ?? '',
        })),
        'Özel',
      );
    }
    toast.success('Excel indirildi');
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {kind === 'PUBLIC' ? 'Kamu ilanları' : 'Özel firmalar'}
          </h1>
          <p className="text-sm text-slate-600">
            {kind === 'PUBLIC'
              ? 'Tablo görünümü · Excel · silme (admin)'
              : 'Firma takip: kanal, mail, form · Excel'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={exportExcel}
            disabled={!items.length}
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-40"
          >
            Excel indir
          </button>
          {kind === 'PRIVATE' && isAdmin && (
            <Link to="/admin" className="rounded border px-3 py-1.5 text-sm">
              Admin’de ekle
            </Link>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="block text-sm">
          <span className="mb-1 block text-slate-500">Ara</span>
          <input
            className="w-56 rounded border px-2 py-1.5 text-sm"
            placeholder="Başlık / kurum / pozisyon…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-500">Eklenme ≥</span>
          <input
            type="date"
            className="rounded border px-2 py-1.5 text-sm"
            value={createdFrom}
            onChange={(e) => setCreatedFrom(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-slate-500">Eklenme ≤</span>
          <input
            type="date"
            className="rounded border px-2 py-1.5 text-sm"
            value={createdTo}
            onChange={(e) => setCreatedTo(e.target.value)}
          />
        </label>
      </div>

      {isLoading && <p className="text-sm text-slate-500">Yükleniyor…</p>}

      {!isLoading && items.length === 0 && (
        <div className="border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
          Kayıt yok.{' '}
          {kind === 'PUBLIC' ? (
            <Link to="/admin" className="text-accent underline">
              Admin’de tara veya yapıştır
            </Link>
          ) : (
            <Link to="/admin" className="text-accent underline">
              Admin’de özel ilan ekle
            </Link>
          )}
        </div>
      )}

      {items.length > 0 && kind === 'PUBLIC' && (
        <div className="overflow-x-auto border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-3 py-2 font-semibold">İlan</th>
                <th className="px-3 py-2 font-semibold">Pozisyon</th>
                <th className="px-3 py-2 font-semibold">Başvuru</th>
                <th className="px-3 py-2 font-semibold">Açıklanma</th>
                <th className="px-3 py-2 font-semibold">Kontrol</th>
                <th className="px-3 py-2 font-semibold">İşlem</th>
                <th className="px-3 py-2 font-semibold">İlan tarihi</th>
                <th className="px-3 py-2 font-semibold">Eklenme</th>
                <th className="px-3 py-2 font-semibold">URL</th>
                <th className="px-3 py-2 font-semibold"> </th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => {
                const pos = row.position || row.positions?.[0]?.title || '—';
                const islem = row.myTracking ? statusLabel(row.myTracking.status) : null;
                return (
                  <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50/80">
                    <td className="max-w-[220px] px-3 py-2">
                      <Link to={`/listings/${row.id}`} className="font-medium hover:text-accent">
                        {row.title}
                      </Link>
                      <p className="text-xs text-slate-500">{row.institution?.name}</p>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{pos}</td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {fmtRange(row.applyStartAt, row.applyEndAt)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {fmtDate(row.resultAnnounceAt)}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {row.myTracking?.updatedFlag
                        ? 'Güncellendi'
                        : row.myTracking
                          ? 'Takipte'
                          : '—'}
                    </td>
                    <td className="px-3 py-2">
                      {islem ? (
                        <span className="text-xs font-medium">{islem}</span>
                      ) : (
                        <button
                          type="button"
                          className="text-xs text-accent underline"
                          onClick={() => track.mutate(row.id)}
                        >
                          Başvurularıma ekle
                        </button>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-600">
                      {fmtRange(row.applyStartAt, row.applyEndAt)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-600">
                      {fmtDate(row.createdAt)}
                    </td>
                    <td className="px-3 py-2">
                      {row.url ? (
                        <a
                          href={row.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-accent underline"
                        >
                          Kaynak
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <Link to={`/listings/${row.id}`} className="mr-2 text-xs underline">
                        Detay
                      </Link>
                      {isAdmin && (
                        <button
                          type="button"
                          className="text-xs text-red-600 underline"
                          onClick={() => {
                            if (confirm(`Silinsin mi?\n${row.title}`)) {
                              removeListing.mutate(row.id);
                            }
                          }}
                        >
                          Sil
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {items.length > 0 && kind === 'PRIVATE' && (
        <div className="overflow-x-auto border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-3 py-2 font-semibold">Firma</th>
                <th className="px-3 py-2 font-semibold">Başvuru</th>
                <th className="px-3 py-2 font-semibold">Mail</th>
                <th className="px-3 py-2 font-semibold">İletişim formu</th>
                <th className="px-3 py-2 font-semibold">Pozisyon</th>
                <th className="px-3 py-2 font-semibold"> </th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => {
                const t = row.myTracking;
                return (
                  <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50/80">
                    <td className="px-3 py-2 font-medium">
                      {row.institution?.name ?? row.title}
                    </td>
                    <td className="px-3 py-2">
                      {t ? (
                        <input
                          className="w-28 rounded border px-2 py-1 text-xs"
                          defaultValue={t.applyChannel ?? ''}
                          placeholder="kariyer.net"
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (v !== (t.applyChannel ?? '')) {
                              patchTrack.mutate({ id: t.id, applyChannel: v });
                            }
                          }}
                        />
                      ) : (
                        <button
                          type="button"
                          className="text-xs text-accent underline"
                          onClick={() => ensureTrack.mutate(row.id)}
                        >
                          Başvurularıma ekle
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={!!t?.mailOk}
                        disabled={!t || patchTrack.isPending}
                        onChange={(e) => {
                          if (!t) return;
                          patchTrack.mutate({ id: t.id, mailOk: e.target.checked });
                        }}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={!!t?.formOk}
                        disabled={!t || patchTrack.isPending}
                        onChange={(e) => {
                          if (!t) return;
                          patchTrack.mutate({ id: t.id, formOk: e.target.checked });
                        }}
                      />
                    </td>
                    <td className="px-3 py-2 text-slate-700">{row.position || '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <Link to={`/listings/${row.id}`} className="mr-2 text-xs underline">
                        Detay
                      </Link>
                      {isAdmin && (
                        <button
                          type="button"
                          className="text-xs text-red-600 underline"
                          onClick={() => {
                            if (confirm(`Silinsin mi?\n${row.title}`)) {
                              removeListing.mutate(row.id);
                            }
                          }}
                        >
                          Sil
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
