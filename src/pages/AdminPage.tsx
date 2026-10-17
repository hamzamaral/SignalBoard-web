import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { api, getErrorMessage } from '@/lib/api';

type PasteKind = 'PUBLIC' | 'PRIVATE';

const SOURCES = [
  {
    code: 'ILAN_GOV' as const,
    label: 'ilan.gov.tr',
    hint: 'Resmi ilan portalından personel duyurularını çeker (özet kayıt).',
  },
  {
    code: 'KAMUILAN' as const,
    label: 'Kamu İlan (SBB)',
    hint: 'kamuilan.sbb.gov.tr ana sayfasındaki aktif ilan özetlerini toplar.',
  },
  {
    code: 'YEREL_YONETIMLER' as const,
    label: 'Yerel Yönetimler (ÇŞB)',
    hint: 'Belediye / yerel yönetim personel duyuru listesini tarar.',
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
      if (save) {
        void qc.invalidateQueries({ queryKey: ['listings'] });
      }
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
      const res = await api.post('/ingest/run', null, source ? { params: { source } } : undefined);
      toast.success(source ? `${labelFor(source)} tamam` : 'Tüm kaynaklar tarandı');
      console.info(res.data);
      void qc.invalidateQueries({ queryKey: ['listings'] });
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setIngestBusy(null);
    }
  }

  const flush = useMutation({
    mutationFn: () => api.post('/ingest/flush-mail'),
    onSuccess: () => toast.success('Bekleyen mailler gönderildi'),
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
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold">Admin</h1>
        <p className="text-slate-600">
          İlan ekleme, e-posta / yapay zekâ ayarları ve kamu kaynaklarından otomatik toplama
        </p>
        <p className="mt-1 text-xs text-slate-400">
          SMTP: {settings.data?.smtpConfigured ? 'hazır' : 'henüz yok'} · LLM:{' '}
          {settings.data?.llm?.provider ?? '—'}
        </p>
      </div>

      <section className="rounded-xl border bg-white/80 p-5">
        <h2 className="font-semibold">İlan yapıştır → ayrıştır</h2>
        <p className="mt-1 text-sm text-slate-500">
          Hem kamu hem özel ilan metni yapıştırılabilir. Tam tarih / kadro tablosu için en güvenilir yol
          budur.
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
              className={`rounded-md px-3 py-1.5 text-sm ${
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
          className="mt-3 min-h-40 w-full rounded-lg border p-3 text-sm"
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          placeholder={
            pasteKind === 'PUBLIC'
              ? 'Kamu ilanı metnini yapıştırın (ör. belediye memur alım ilanı)…'
              : 'Özel sektör ilanı metnini yapıştırın…'
          }
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm"
            onClick={() => parse.mutate(false)}
            disabled={!paste.trim() || parse.isPending}
          >
            Sadece ayrıştır
          </button>
          <button
            type="button"
            className="rounded-md bg-accent px-3 py-2 text-sm text-white"
            onClick={() => parse.mutate(true)}
            disabled={!paste.trim() || parse.isPending}
          >
            Ayrıştır ve kaydet
          </button>
        </div>
        {parsed && (
          <div className="mt-4 rounded-lg border border-teal-100 bg-teal-50/60 p-4 text-sm">
            <p className="font-medium text-ink">{parsed.title ?? 'Başlıksız'}</p>
            <p className="mt-1 text-slate-600">
              {parsed.institutionName ?? 'Kurum yok'}
              {parsed.city ? ` · ${parsed.city}` : ''}
            </p>
            <p className="mt-1 text-slate-500">
              Başvuru: {fmtIso(parsed.applyStartAt)} – {fmtIso(parsed.applyEndAt)} · Kadro:{' '}
              {parsed.positions?.length ?? 0}
            </p>
            <p className="mt-2 text-xs text-slate-400">
              Motor: {parse.data?.engine ?? 'rules'}
            </p>
          </div>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3 rounded-xl border bg-white/80 p-5">
          <div>
            <h2 className="font-semibold">E-posta (SMTP)</h2>
            <p className="text-sm text-slate-500">
              Uygun ilan bildirimi göndermek için. Key’ler veritabanında şifreli saklanır; GitHub’a
              gitmez.
            </p>
          </div>
          <Labeled label="Sunucu (host)">
            <input
              className="w-full rounded border px-3 py-2 text-sm"
              value={smtp.host}
              onChange={(e) => setSmtp({ ...smtp, host: e.target.value })}
              placeholder="smtp.örnek.com"
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
          <Labeled label="Gönderen (from)">
            <input
              className="w-full rounded border px-3 py-2 text-sm"
              value={smtp.from}
              onChange={(e) => setSmtp({ ...smtp, from: e.target.value })}
              placeholder="SignalBoard <noreply@örnek.com>"
            />
          </Labeled>
          <Labeled label="Port">
            <input
              className="w-full rounded border px-3 py-2 text-sm"
              type="number"
              value={smtp.port}
              onChange={(e) => setSmtp({ ...smtp, port: Number(e.target.value) })}
            />
          </Labeled>
          <button
            type="button"
            className="rounded-md bg-accent px-3 py-2 text-sm text-white"
            onClick={() => saveSmtp.mutate()}
          >
            SMTP kaydet
          </button>
        </div>

        <div className="space-y-3 rounded-xl border bg-white/80 p-5">
          <div>
            <h2 className="font-semibold">Metin ayrıştırma (LLM)</h2>
            <p className="text-sm text-slate-500">
              Varsayılan Ollama yerelde ücretsiz çalışır. Gemini/Groq için API anahtarı isteğe bağlıdır.
            </p>
          </div>
          <Labeled label="Sağlayıcı">
            <select
              className="w-full rounded border px-3 py-2 text-sm"
              value={llm.provider}
              onChange={(e) => setLlm({ ...llm, provider: e.target.value })}
            >
              <option value="OLLAMA">Ollama (yerel, ücretsiz)</option>
              <option value="GEMINI">Gemini</option>
              <option value="GROQ">Groq</option>
              <option value="NONE">Kapalı (sadece kurallar)</option>
            </select>
          </Labeled>
          <Labeled label="Model">
            <input
              className="w-full rounded border px-3 py-2 text-sm"
              value={llm.model}
              onChange={(e) => setLlm({ ...llm, model: e.target.value })}
            />
          </Labeled>
          <Labeled label="API anahtarı (Gemini / Groq)">
            <input
              className="w-full rounded border px-3 py-2 text-sm"
              type="password"
              value={llm.apiKey}
              onChange={(e) => setLlm({ ...llm, apiKey: e.target.value })}
              placeholder="Boş bırakılabilir"
            />
          </Labeled>
          <button
            type="button"
            className="rounded-md bg-accent px-3 py-2 text-sm text-white"
            onClick={() => saveLlm.mutate()}
          >
            LLM kaydet
          </button>
        </div>
      </section>

      <section className="rounded-xl border bg-white/80 p-5">
        <h2 className="font-semibold">Kaynaklardan otomatik topla</h2>
        <p className="mt-1 text-sm text-slate-500">
          Sitelerden özet ilan çeker. Tarih / kadro detayı eksik olabilir; tam metin için yukarıdaki
          yapıştır alanını kullanın.
        </p>
        <div className="mt-4 space-y-3">
          <SourceRow
            title="Hepsini tara"
            hint="Üç kamu kaynağını sırayla çalıştırır."
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
            hint="Bildirim kuyruğundaki e-postaları SMTP ile yollar."
            busy={flush.isPending}
            onClick={() => flush.mutate()}
          />
        </div>
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
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-sm">{title}</p>
        <p className="text-xs text-slate-500">{hint}</p>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={onClick}
        className="shrink-0 rounded-md border px-3 py-1.5 text-sm hover:bg-panel disabled:opacity-50"
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
