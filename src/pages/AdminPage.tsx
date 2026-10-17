import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { api, getErrorMessage } from '@/lib/api';

type PasteKind = 'PUBLIC' | 'PRIVATE';

type IngestSourceResult = {
  source: string;
  upserted: number;
  created?: number;
  updated?: number;
  duplicatesSkipped?: number;
  rawCount: number;
  error?: string;
  hint?: string;
};

type IngestReport = {
  sources: IngestSourceResult[];
  totalUpserted: number;
  totalRaw: number;
  ok: boolean;
  summary: string;
};

const SOURCES = [
  {
    code: 'ILAN_GOV' as const,
    label: 'ilan.gov.tr',
    hint: 'Personel duyuruları (özet).',
  },
  {
    code: 'KAMUILAN' as const,
    label: 'Kamu İlan (SBB)',
    hint: 'Ana sayfa aktif ilan özetleri + tarih aralığı.',
  },
  {
    code: 'YEREL_YONETIMLER' as const,
    label: 'Yerel Yönetimler (ÇŞB)',
    hint: 'Personel duyuru linkleri.',
  },
];

export function AdminPage() {
  const qc = useQueryClient();
  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await api.get('/settings')).data,
  });

  const [paste, setPaste] = useState('');
  const [pasteKind, setPasteKind] = useState<PasteKind>('PUBLIC');
  const [smtp, setSmtp] = useState({
    host: '',
    port: 587,
    secure: false,
    user: '',
    pass: '',
    from: '',
  });
  const [llm, setLlm] = useState({ provider: 'OLLAMA', model: 'llama3.2', apiKey: '' });
  const [ingestBusy, setIngestBusy] = useState<string | null>(null);
  const [ingestReport, setIngestReport] = useState<IngestReport | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const parse = useMutation({
    mutationFn: async (save: boolean) =>
      (
        await api.post('/listings/parse', {
          text: paste,
          save,
          kind: pasteKind,
          source: pasteKind === 'PRIVATE' ? 'PRIVATE' : 'MANUAL',
        })
      ).data,
    onSuccess: (_data, save) => {
      toast.success(save ? 'İlan kaydedildi' : 'Ayrıştırma tamam');
      if (save) void qc.invalidateQueries({ queryKey: ['listings'] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const saveSmtp = useMutation({
    mutationFn: () => api.put('/settings/smtp', smtp),
    onSuccess: () => {
      toast.success('SMTP kaydedildi');
      void qc.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const saveLlm = useMutation({
    mutationFn: () => api.put('/settings/llm', llm),
    onSuccess: () => {
      toast.success('LLM ayarı kaydedildi');
      void qc.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  async function runIngest(source?: string) {
    const key = source ?? 'ALL';
    setIngestBusy(key);
    try {
      const res = await api.post<IngestReport>(
        '/ingest/run',
        null,
        source ? { params: { source } } : undefined,
      );
      setIngestReport(res.data);
      if (res.data.ok) {
        toast.success(res.data.summary);
      } else {
        toast.error(res.data.summary || 'Çekilemedi');
      }
      void qc.invalidateQueries({ queryKey: ['listings'] });
    } catch (e) {
      setIngestReport({
        sources: [
          {
            source: key,
            upserted: 0,
            rawCount: 0,
            error: getErrorMessage(e),
            hint: 'İstek başarısız',
          },
        ],
        totalUpserted: 0,
        totalRaw: 0,
        ok: false,
        summary: getErrorMessage(e),
      });
      toast.error(getErrorMessage(e));
    } finally {
      setIngestBusy(null);
    }
  }

  const [mailReport, setMailReport] = useState<{
    message?: string;
    processed?: number;
    pending?: number;
    ok?: boolean;
  } | null>(null);

  const flush = useMutation({
    mutationFn: async () => (await api.post('/ingest/flush-mail')).data,
    onSuccess: (data) => {
      setMailReport(data);
      if (data?.ok) toast.success(data.message ?? 'Mailler gönderildi');
      else toast.message(data?.message ?? 'Kuyruk boş veya SMTP yok');
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const parsed = parse.data?.parsed as
    | {
        institutionName?: string;
        title?: string;
        applyStartAt?: string;
        applyEndAt?: string;
        positions?: unknown[];
        city?: string;
      }
    | undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Admin</h1>
        <p className="text-sm text-slate-600">
          Yapıştır · kaynak tara · SMTP/LLM · SMTP:{' '}
          {settings.data?.smtpConfigured ? 'hazır' : 'yok'} · LLM:{' '}
          {settings.data?.llm?.provider ?? '—'}
        </p>
      </div>

      <section className="border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          İlan yapıştır
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Tam tarih / kadro için birincil yol. Kamu veya özel seçin.
        </p>
        <div className="mt-3 flex gap-2">
          {(
            [
              ['PUBLIC', 'Kamu'],
              ['PRIVATE', 'Özel'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setPasteKind(value)}
              className={`rounded px-3 py-1.5 text-sm ${
                pasteKind === value
                  ? 'bg-accent text-white'
                  : 'border border-slate-300 text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <textarea
          className="mt-3 min-h-36 w-full rounded border border-slate-300 p-3 text-sm"
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          placeholder={
            pasteKind === 'PUBLIC'
              ? 'Kamu ilanı metnini yapıştırın…'
              : 'Özel sektör ilanı metnini yapıştırın…'
          }
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded border px-3 py-2 text-sm"
            onClick={() => parse.mutate(false)}
            disabled={!paste.trim() || parse.isPending}
          >
            Sadece ayrıştır
          </button>
          <button
            type="button"
            className="rounded bg-accent px-3 py-2 text-sm text-white"
            onClick={() => parse.mutate(true)}
            disabled={!paste.trim() || parse.isPending}
          >
            Ayrıştır ve kaydet
          </button>
        </div>
        {parsed && (
          <div className="mt-3 border border-teal-200 bg-teal-50/70 p-3 text-sm">
            <p className="font-medium">{parsed.title ?? 'Başlıksız'}</p>
            <p className="text-slate-600">
              {parsed.institutionName ?? 'Kurum yok'}
              {parsed.city ? ` · ${parsed.city}` : ''}
            </p>
            <p className="text-slate-500">
              Başvuru: {fmtIso(parsed.applyStartAt)} – {fmtIso(parsed.applyEndAt)} · Kadro:{' '}
              {parsed.positions?.length ?? 0}
            </p>
          </div>
        )}
      </section>

      <section className="border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Kaynaklardan otomatik topla
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Özet çeker. Sonuç aşağıda görünür; 0 ise hata/hint yazılır. Tam metin için yapıştır.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Güncelleme = aynı kaynak anahtarıyla mevcut kayıt yenilendi (başlık/url/tarih/rawText);
          çift satır oluşmaz. Version artar; takipteysen “güncellendi” bayrağı açılır.
        </p>

        {ingestReport && (
          <div
            className={`mt-3 border p-3 text-sm ${
              ingestReport.ok
                ? 'border-emerald-200 bg-emerald-50'
                : 'border-amber-300 bg-amber-50'
            }`}
          >
            <p className="font-medium">{ingestReport.summary}</p>
            <p className="mt-1 text-xs text-slate-600">
              Güncelleme = aynı kaynak anahtarıyla mevcut kayıt yenilendi; çift satır oluşmaz.
            </p>
            <ul className="mt-2 space-y-1.5">
              {ingestReport.sources.map((s) => (
                <li key={s.source} className="flex flex-wrap gap-x-3 gap-y-0.5">
                  <span className="font-medium">{labelFor(s.source)}</span>
                  <span>
                    {s.created != null || s.updated != null
                      ? `${s.created ?? 0} yeni · ${s.updated ?? 0} güncellendi`
                      : `${s.upserted} işlendi`}{' '}
                    / {s.rawCount} ham
                    {s.duplicatesSkipped
                      ? ` · ${s.duplicatesSkipped} tekrar link atlandı`
                      : ''}
                  </span>
                  {s.error && <span className="text-red-700">Hata: {s.error}</span>}
                  {s.hint && <span className="text-slate-600">{s.hint}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-3 divide-y border border-slate-200">
          <SourceRow
            title="Hepsini tara"
            hint="Üç kaynağı sırayla çalıştırır."
            busy={ingestBusy === 'ALL'}
            onClick={() => void runIngest()}
          />
          {SOURCES.map((s) => (
            <SourceRow
              key={s.code}
              title={s.label}
              hint={s.hint}
              busy={ingestBusy === s.code}
              onClick={() => void runIngest(s.code)}
            />
          ))}
          <SourceRow
            title="Bekleyen mailleri gönder"
            hint="SMTP kuyruğu — ayar yoksa mail gitmez."
            busy={flush.isPending}
            onClick={() => flush.mutate()}
          />
        </div>
        {mailReport && (
          <p
            className={`mt-3 border p-2 text-sm ${
              mailReport.ok ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'
            }`}
          >
            {mailReport.message}
            {typeof mailReport.pending === 'number' ? ` (bekleyen: ${mailReport.pending})` : ''}
          </p>
        )}
      </section>

      <section className="border border-slate-200 bg-white">
        <button
          type="button"
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold"
          onClick={() => setSettingsOpen((v) => !v)}
        >
          <span>SMTP / LLM ayarları</span>
          <span className="text-slate-400">{settingsOpen ? '−' : '+'}</span>
        </button>
        {settingsOpen && (
          <div className="grid gap-4 border-t px-4 py-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-xs text-slate-500">E-posta bildirimi için SMTP</p>
              <Labeled label="Sunucu">
                <input
                  className="w-full rounded border px-3 py-2 text-sm"
                  value={smtp.host}
                  onChange={(e) => setSmtp({ ...smtp, host: e.target.value })}
                />
              </Labeled>
              <Labeled label="Kullanıcı">
                <input
                  className="w-full rounded border px-3 py-2 text-sm"
                  value={smtp.user}
                  onChange={(e) => setSmtp({ ...smtp, user: e.target.value })}
                />
              </Labeled>
              <Labeled label="Şifre">
                <input
                  type="password"
                  className="w-full rounded border px-3 py-2 text-sm"
                  value={smtp.pass}
                  onChange={(e) => setSmtp({ ...smtp, pass: e.target.value })}
                />
              </Labeled>
              <Labeled label="Gönderen">
                <input
                  className="w-full rounded border px-3 py-2 text-sm"
                  value={smtp.from}
                  onChange={(e) => setSmtp({ ...smtp, from: e.target.value })}
                />
              </Labeled>
              <button
                type="button"
                className="rounded bg-accent px-3 py-2 text-sm text-white"
                onClick={() => saveSmtp.mutate()}
              >
                SMTP kaydet
              </button>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-slate-500">Ollama yerelde ücretsiz</p>
              <Labeled label="Sağlayıcı">
                <select
                  className="w-full rounded border px-3 py-2 text-sm"
                  value={llm.provider}
                  onChange={(e) => setLlm({ ...llm, provider: e.target.value })}
                >
                  <option value="OLLAMA">Ollama</option>
                  <option value="GEMINI">Gemini</option>
                  <option value="GROQ">Groq</option>
                  <option value="NONE">Kapalı</option>
                </select>
              </Labeled>
              <Labeled label="Model">
                <input
                  className="w-full rounded border px-3 py-2 text-sm"
                  value={llm.model}
                  onChange={(e) => setLlm({ ...llm, model: e.target.value })}
                />
              </Labeled>
              <Labeled label="API anahtarı">
                <input
                  className="w-full rounded border px-3 py-2 text-sm"
                  type="password"
                  value={llm.apiKey}
                  onChange={(e) => setLlm({ ...llm, apiKey: e.target.value })}
                />
              </Labeled>
              <button
                type="button"
                className="rounded bg-accent px-3 py-2 text-sm text-white"
                onClick={() => saveLlm.mutate()}
              >
                LLM kaydet
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function SourceRow({
  title,
  hint,
  busy,
  onClick,
}: {
  title: string;
  hint: string;
  busy?: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-slate-500">{hint}</p>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={onClick}
        className="shrink-0 rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
      >
        {busy ? 'Çalışıyor…' : 'Çalıştır'}
      </button>
    </div>
  );
}

function labelFor(code: string) {
  return SOURCES.find((s) => s.code === code)?.label ?? code;
}

function fmtIso(v?: string) {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('tr-TR');
}
