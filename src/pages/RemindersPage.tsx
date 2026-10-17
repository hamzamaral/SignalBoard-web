import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { api, getErrorMessage } from '@/lib/api';
import { tokenStorage } from '@/lib/token-storage';

type Reminder = { id: string; title: string; remindAt: string; note?: string | null };

export function RemindersPage() {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [remindAt, setRemindAt] = useState('');

  const { data } = useQuery({
    queryKey: ['reminders'],
    queryFn: async () => (await api.get<Reminder[]>('/reminders')).data,
  });

  const create = useMutation({
    mutationFn: () =>
      api.post('/reminders', { title, remindAt: new Date(remindAt).toISOString() }),
    onSuccess: () => {
      toast.success('Hatırlatıcı eklendi');
      setTitle('');
      setRemindAt('');
      void qc.invalidateQueries({ queryKey: ['reminders'] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  async function downloadIcs() {
    const token = tokenStorage.getAccess();
    const res = await fetch('/api/v1/reminders/export.ics', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'signalboard-reminders.ics';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Hatırlatıcılar</h1>
          <p className="text-slate-600">İleri tarihli son başvurular için ICS dışa aktarım</p>
        </div>
        <button
          type="button"
          onClick={() => void downloadIcs()}
          className="rounded-lg border px-3 py-2 text-sm"
        >
          .ics indir
        </button>
      </div>

      <div className="grid gap-3 rounded-xl border bg-white/80 p-4 sm:grid-cols-[1fr_1fr_auto]">
        <input
          className="rounded-lg border px-3 py-2"
          placeholder="Başlık"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          type="datetime-local"
          className="rounded-lg border px-3 py-2"
          value={remindAt}
          onChange={(e) => setRemindAt(e.target.value)}
        />
        <button
          type="button"
          className="rounded-lg bg-accent px-4 py-2 text-white"
          onClick={() => create.mutate()}
        >
          Ekle
        </button>
      </div>

      <ul className="space-y-2">
        {(data ?? []).map((r) => (
          <li key={r.id} className="rounded-lg border bg-white/80 px-4 py-3">
            <p className="font-medium">{r.title}</p>
            <p className="text-sm text-slate-500">{new Date(r.remindAt).toLocaleString('tr-TR')}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
