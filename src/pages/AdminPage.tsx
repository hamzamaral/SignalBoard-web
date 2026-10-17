import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { api, getErrorMessage } from '@/lib/api';

export function AdminPage() {
  const qc = useQueryClient();
  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await api.get('/settings')).data,
  });

  const [paste, setPaste] = useState('');
  const [smtp, setSmtp] = useState({
    host: '',
    port: 587,
    secure: false,
    user: '',
    pass: '',
    from: '',
  });
  const [llm, setLlm] = useState({ provider: 'OLLAMA', model: 'llama3.2', apiKey: '' });

  const parse = useMutation({
    mutationFn: async (save: boolean) =>
      (await api.post('/listings/parse', { text: paste, save, kind: 'PUBLIC', source: 'MANUAL' }))
        .data,
    onSuccess: (data, save) => {
      toast.success(save ? 'İlan kaydedildi' : 'Parse tamam');
      console.info(data);
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

  const ingest = useMutation({
    mutationFn: () => api.post('/ingest/run', null, { params: { source: 'ILAN_GOV' } }),
    onSuccess: (res) => {
      toast.success('Ingest çalıştı');
      console.info(res.data);
      void qc.invalidateQueries({ queryKey: ['listings'] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const flush = useMutation({
    mutationFn: () => api.post('/ingest/flush-mail'),
    onSuccess: () => toast.success('Mail kuyruğu işlendi'),
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold">Admin</h1>
        <p className="text-slate-600">SMTP, LLM, paste-parse ve kaynak ingest</p>
        <p className="mt-1 text-xs text-slate-400">
          SMTP: {settings.data?.smtpConfigured ? 'yapılandırıldı' : 'yok'} · LLM:{' '}
          {settings.data?.llm?.provider ?? '—'}
        </p>
      </div>

      <section className="rounded-xl border bg-white/80 p-5">
        <h2 className="font-semibold">İlan yapıştır → ayrıştır</h2>
        <textarea
          className="mt-3 min-h-40 w-full rounded-lg border p-3 text-sm"
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          placeholder="Kamu ilanı metnini yapıştırın…"
        />
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm"
            onClick={() => parse.mutate(false)}
          >
            Sadece parse
          </button>
          <button
            type="button"
            className="rounded-md bg-accent px-3 py-2 text-sm text-white"
            onClick={() => parse.mutate(true)}
          >
            Parse + kaydet
          </button>
        </div>
        {parse.data && (
          <pre className="mt-3 overflow-auto rounded bg-slate-900 p-3 text-xs text-green-200">
            {JSON.stringify(parse.data, null, 2)}
          </pre>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-white/80 p-5 space-y-2">
          <h2 className="font-semibold">SMTP</h2>
          {(['host', 'user', 'pass', 'from'] as const).map((k) => (
            <input
              key={k}
              className="w-full rounded border px-3 py-2 text-sm"
              placeholder={k}
              type={k === 'pass' ? 'password' : 'text'}
              value={smtp[k]}
              onChange={(e) => setSmtp({ ...smtp, [k]: e.target.value })}
            />
          ))}
          <input
            className="w-full rounded border px-3 py-2 text-sm"
            type="number"
            value={smtp.port}
            onChange={(e) => setSmtp({ ...smtp, port: Number(e.target.value) })}
          />
          <button
            type="button"
            className="rounded-md bg-accent px-3 py-2 text-sm text-white"
            onClick={() => saveSmtp.mutate()}
          >
            SMTP kaydet
          </button>
        </div>

        <div className="rounded-xl border bg-white/80 p-5 space-y-2">
          <h2 className="font-semibold">LLM (ücretsiz varsayılan: Ollama)</h2>
          <select
            className="w-full rounded border px-3 py-2 text-sm"
            value={llm.provider}
            onChange={(e) => setLlm({ ...llm, provider: e.target.value })}
          >
            <option value="OLLAMA">OLLAMA</option>
            <option value="GEMINI">GEMINI</option>
            <option value="GROQ">GROQ</option>
            <option value="NONE">NONE (sadece kurallar)</option>
          </select>
          <input
            className="w-full rounded border px-3 py-2 text-sm"
            placeholder="model"
            value={llm.model}
            onChange={(e) => setLlm({ ...llm, model: e.target.value })}
          />
          <input
            className="w-full rounded border px-3 py-2 text-sm"
            placeholder="apiKey (gemini/groq)"
            type="password"
            value={llm.apiKey}
            onChange={(e) => setLlm({ ...llm, apiKey: e.target.value })}
          />
          <button
            type="button"
            className="rounded-md bg-accent px-3 py-2 text-sm text-white"
            onClick={() => saveLlm.mutate()}
          >
            LLM kaydet
          </button>
        </div>
      </section>

      <section className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-md border px-3 py-2 text-sm"
          onClick={() => ingest.mutate()}
        >
          Tüm kaynakları tara
        </button>
        {(['ILAN_GOV', 'KAMUILAN', 'YEREL_YONETIMLER'] as const).map((source) => (
          <button
            key={source}
            type="button"
            className="rounded-md border px-3 py-2 text-sm"
            onClick={() =>
              api
                .post('/ingest/run', null, { params: { source } })
                .then((res) => {
                  toast.success(`${source} tamam`);
                  console.info(res.data);
                  void qc.invalidateQueries({ queryKey: ['listings'] });
                })
                .catch((e) => toast.error(getErrorMessage(e)))
            }
          >
            {source}
          </button>
        ))}
        <button
          type="button"
          className="rounded-md border px-3 py-2 text-sm"
          onClick={() => flush.mutate()}
        >
          Mail kuyruğunu işle
        </button>
      </section>
    </div>
  );
}
