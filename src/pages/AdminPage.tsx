import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ListingForm, emptyListingForm, formToBody, type ListingFormValues } from '@/components/ListingForm';
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

type IngestJob = {
  running: boolean;
  requested: string | null;
  current: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  completed: IngestSourceResult[];
  report: IngestReport | null;
  error: string | null;
};

const SOURCES = [
  {
    code: 'ILAN_GOV' as const,
    label: 'ilan.gov.tr',
    hint: 'Kamu personel kategorisinin tamamı.',
  },
  {
    code: 'KAMUILAN' as const,
    label: 'Kamu İlan (SBB)',
    hint: 'Tüm ilanlar listesi.',
  },
  {
    code: 'YEREL_YONETIMLER' as const,
    label: 'Yerel Yönetimler (ÇŞB)',
    hint: 'Duyuru listesinin bütün sayfaları.',
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
  const [manual, setManual] = useState<ListingFormValues>(() => emptyListingForm());
  const [draftText, setDraftText] = useState('');
  const [draftParsed, setDraftParsed] = useState<ParsedFields | null>(null);
  const [smtp, setSmtp] = useState({
    host: '',
    port: 587,
    secure: false,
    user: '',
    pass: '',
    from: '',
  });
  const [llm, setLlm] = useState({ provider: 'OLLAMA', model: 'llama3.2', apiKey: '' });
  const [ingestReport, setIngestReport] = useState<IngestReport | null>(null);
  const seenFinish = useRef<string | null | undefined>(undefined);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const ingestStatus = useQuery({
    queryKey: ['ingest-status'],
    queryFn: async () => (await api.get<IngestJob>('/ingest/status')).data,
    refetchInterval: (query) => (query.state.data?.running ? 2000 : false),
  });
  const ingestJob = ingestStatus.data;
  const elapsed = useElapsed(ingestJob?.startedAt, Boolean(ingestJob?.running));

  useEffect(() => {
    const job = ingestStatus.data;
    if (!job) return;
    if (seenFinish.current === undefined) {
      seenFinish.current = job.finishedAt;
      if (job.report) setIngestReport(job.report);
      return;
    }
    if (job.running || !job.finishedAt || seenFinish.current === job.finishedAt) return;
    seenFinish.current = job.finishedAt;
    if (job.report) {
      setIngestReport(job.report);
      if (job.report.ok) toast.success(job.report.summary);
      else toast.error(job.report.summary || 'Çekilemedi');
      void qc.invalidateQueries({ queryKey: ['listings'] });
    } else if (job.error) {
      toast.error(job.error);
    }
  }, [ingestStatus.data, qc]);

  const createManual = useMutation({
    mutationFn: async () =>
      (
        await api.post('/listings', {
          ...formToBody(manual, 'create'),
          ...extrasFromParsed(draftParsed, draftText),
        })
      ).data,
    onSuccess: () => {
      toast.success('İlan eklendi');
      setManual(emptyListingForm(manual.kind));
      setDraftText('');
      setDraftParsed(null);
      void qc.invalidateQueries({ queryKey: ['listings'] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const fillFromText = useMutation({
    mutationFn: async () =>
      (
        await api.post<{ parsed: ParsedFields; engine: string }>('/listings/parse', {
          text: draftText,
          save: false,
          kind: manual.kind,
        })
      ).data,
    onSuccess: (data) => {
      const parsed = data.parsed ?? {};
      const replace = parsed.shape === 'job-board';
      const keep = (next?: string, previous?: string) =>
        replace ? next || '' : next || previous || '';
      setDraftParsed(parsed);
      setManual((current) => ({
        ...current,
        kind: parsed.kind === 'PRIVATE' || parsed.kind === 'PUBLIC' ? parsed.kind : current.kind,
        title: keep(parsed.title, current.title),
        institutionName: keep(parsed.institutionName, current.institutionName),
        city: keep(parsed.city, current.city),
        position: keep(parsed.position || parsed.positions?.[0]?.title, current.position),
        url: keep(parsed.url, current.url),
        publishedAt: isoDay(parsed.publishedAt),
        applyStartAt: isoDay(parsed.applyStartAt),
        applyEndAt: isoDay(parsed.applyEndAt),
        examAt: isoDay(parsed.examAt),
        resultAnnounceAt: isoDay(parsed.resultAnnounceAt),
        description: keep(parsed.description, current.description || summaryOf(parsed)),
      }));
      toast.success(
        data.engine === 'rules+llm'
          ? 'Yapay zeka ve kurallar alanları doldurdu. Kontrol edip kaydet.'
          : 'Alanlar dolduruldu. Kontrol edip kaydet.',
      );
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

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
    try {
      const res = await api.post<{ started: boolean; job: IngestJob }>(
        '/ingest/run',
        null,
        source ? { params: { source } } : undefined,
      );
      qc.setQueryData(['ingest-status'], res.data.job);
      if (res.data.started) {
        toast.message('Tarama arka planda başladı. İlan ekleyip güncellemeye devam edebilirsin.');
      } else {
        toast.message('Bir tarama zaten sürüyor.');
      }
    } catch (e) {
      toast.error(getErrorMessage(e));
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
          {settings.data?.smtpConfigured ? 'hazır' : 'ayarlanmadı'} · LLM:{' '}
          {settings.data?.llm?.provider ?? '—'}
        </p>
      </div>

      <section className="border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Manuel ilan ekle
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          İlan metnini yapıştır; yapay zeka ve kurallar alanları doldursun. Kontrol edip kaydet.
          Mevcut ilanı düzenlemek için listeden detaya gir.
        </p>
        <label className="mt-3 block text-sm">
          <span className="mb-1 block text-slate-600">İlan metni</span>
          <textarea
            className="min-h-36 w-full rounded border border-slate-300 p-3 text-sm"
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            placeholder="Belediye veya kurum ilanının tam metnini buraya yapıştır…"
          />
        </label>
        <button
          type="button"
          className="mt-2 rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
          disabled={draftText.trim().length < 20 || fillFromText.isPending}
          onClick={() => fillFromText.mutate()}
        >
          {fillFromText.isPending ? 'Dolduruluyor…' : 'Metinden doldur'}
        </button>
        {draftParsed?.positions?.length ? (
          <ul className="mt-3 space-y-1 border border-teal-200 bg-teal-50/70 p-3 text-sm">
            {draftParsed.positions.map((p) => (
              <li key={`${p.sequenceNo}-${p.title}`}>
                {p.sequenceNo ? `${p.sequenceNo}. ` : ''}
                {p.title}
                {p.serviceClass ? ` · ${p.serviceClass}` : ''}
                {p.grade ? ` · derece ${p.grade}` : ''}
                {p.quota ? ` · ${p.quota} adet` : ''}
                {p.kpssScoreType ? ` · ${p.kpssScoreType}` : ''}
                {p.kpssMinScore ? ` ≥ ${p.kpssMinScore}` : ''}
                {p.gender ? ` · ${p.gender}` : ''}
              </li>
            ))}
          </ul>
        ) : null}
        <ListingForm
          mode="create"
          values={manual}
          onChange={setManual}
          pending={createManual.isPending}
          onSubmit={() => createManual.mutate()}
        />
      </section>

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
          Özet çeker ve arka planda sürer; tam tarama birkaç dakika sürebilir. Bu sırada yukarıdan
          ilan ekleyebilir, ilan detayından mevcut kaydı güncelleyebilirsin.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Güncelleme = aynı kaynak anahtarıyla mevcut kayıt yenilendi (başlık/url/tarih/rawText);
          çift satır oluşmaz. Version artar; takipteysen “güncellendi” bayrağı açılır.
        </p>

        {ingestJob?.running && (
          <p className="mt-3 border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950">
            {labelFor(ingestJob.current ?? ingestJob.requested ?? '')} taranıyor
            {elapsed ? ` · ${elapsed}` : ''}. Sayfadan çıksan da devam eder.
          </p>
        )}

        {(ingestJob?.completed.length ?? 0) > 0 && ingestJob?.running && (
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            {ingestJob.completed.map((s) => (
              <li key={s.source}>
                {labelFor(s.source)}: {s.created ?? 0} yeni · {s.updated ?? 0} güncellendi
              </li>
            ))}
          </ul>
        )}

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
            hint="Üç kaynağı sırayla, arka planda çalıştırır."
            label={scanLabel('ALL', ingestJob, elapsed)}
            disabled={Boolean(ingestJob?.running)}
            onClick={() => void runIngest()}
          />
          {SOURCES.map((s) => (
            <SourceRow
              key={s.code}
              title={s.label}
              hint={s.hint}
              label={scanLabel(s.code, ingestJob, elapsed)}
              disabled={Boolean(ingestJob?.running)}
              onClick={() => void runIngest(s.code)}
            />
          ))}
          <SourceRow
            title="Bekleyen mailleri gönder"
            hint="SMTP kuyruğu — önce SMTP ayarlarını kaydedin."
            label={flush.isPending ? 'Çalışıyor…' : 'Çalıştır'}
            disabled={flush.isPending}
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
  label,
  disabled,
  onClick,
}: {
  title: string;
  hint: string;
  label: string;
  disabled?: boolean;
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
        disabled={disabled}
        onClick={onClick}
        className="shrink-0 rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
      >
        {label}
      </button>
    </div>
  );
}

function scanLabel(code: string, job: IngestJob | undefined, elapsed: string) {
  if (!job?.running) return 'Çalıştır';
  if (job.current === code || (code === 'ALL' && job.requested === 'ALL')) {
    return elapsed ? `Çalışıyor… ${elapsed}` : 'Çalışıyor…';
  }
  if (job.requested !== 'ALL') return 'Beklemede';
  const order = SOURCES.map((s) => s.code);
  const current = order.indexOf(job.current as (typeof order)[number]);
  const mine = order.indexOf(code as (typeof order)[number]);
  if (mine >= 0 && current >= 0 && mine < current) return 'Bitti';
  return 'Sırada';
}

function useElapsed(startedAt: string | null | undefined, running: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [running]);
  if (!running || !startedAt) return '';
  const seconds = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
  const minutes = Math.floor(seconds / 60);
  return minutes > 0 ? `${minutes} dk ${seconds % 60} sn` : `${seconds} sn`;
}

type ParsedFields = {
  kind?: 'PUBLIC' | 'PRIVATE';
  description?: string;
  shape?: 'job-board';
  institutionName?: string;
  title?: string;
  position?: string;
  city?: string;
  url?: string;
  publishedAt?: string;
  educationLevel?: string;
  kpssScoreType?: string;
  kpssMinScore?: number;
  quota?: number;
  applyStartAt?: string;
  applyEndAt?: string;
  examAt?: string;
  resultAnnounceAt?: string;
  applicationPlace?: string;
  applicationMethods?: string[];
  requiredDocuments?: string[];
  generalRequirements?: string;
  specialRequirements?: string;
  examTopics?: string;
  evaluationNotes?: string;
  positions?: Array<{
    sequenceNo?: number;
    title: string;
    serviceClass?: string;
    grade?: number;
    quota?: number;
    gender?: string;
    educationRequirement?: string;
    kpssScoreType?: string;
    kpssMinScore?: number;
  }>;
};

function isoDay(value?: string) {
  if (!value) return '';
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);
  return match ? match[1] : '';
}

function summaryOf(parsed: ParsedFields) {
  const first = parsed.positions?.[0];
  const bits = [
    parsed.institutionName,
    first ? `${first.title}${first.quota ? ` (${first.quota})` : ''}` : parsed.position,
    first?.kpssScoreType ? `${first.kpssScoreType} ≥ ${first.kpssMinScore ?? '?'}` : '',
  ].filter(Boolean);
  return bits.join(' · ');
}

function extrasFromParsed(parsed: ParsedFields | null, raw: string) {
  const body: Record<string, unknown> = {};
  if (raw.trim()) body.rawText = raw.trim();
  if (!parsed) return body;
  const textKeys = [
    'educationLevel',
    'kpssScoreType',
    'applicationPlace',
    'generalRequirements',
    'specialRequirements',
    'examTopics',
    'evaluationNotes',
  ] as const;
  for (const key of textKeys) {
    if (parsed[key]) body[key] = parsed[key];
  }
  if (parsed.kpssMinScore) body.kpssMinScore = parsed.kpssMinScore;
  if (parsed.quota) body.quota = parsed.quota;
  if (parsed.applicationMethods?.length) body.applicationMethods = parsed.applicationMethods;
  if (parsed.requiredDocuments?.length) body.requiredDocuments = parsed.requiredDocuments;
  if (parsed.positions?.length) {
    body.positions = parsed.positions.map((p) => ({
      sequenceNo: p.sequenceNo,
      title: p.title,
      serviceClass: p.serviceClass,
      grade: p.grade,
      quota: p.quota,
      gender: p.gender,
      educationRequirement: p.educationRequirement,
      kpssScoreType: p.kpssScoreType,
      kpssMinScore: p.kpssMinScore,
    }));
  }
  return body;
}

function labelFor(code: string) {
  return SOURCES.find((s) => s.code === code)?.label ?? code;
}

function fmtIso(v?: string) {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('tr-TR');
}
