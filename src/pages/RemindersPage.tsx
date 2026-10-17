import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { api, getErrorMessage } from '@/lib/api';
import { tokenStorage } from '@/lib/token-storage';

type Reminder = { id: string; title: string; remindAt: string; note?: string | null };

export function RemindersPage() {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [remindAt, setRemindAt] = useState('');
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['reminders'],
    queryFn: async () => (await api.get<Reminder[]>('/reminders')).data,
  });

  const byDay = useMemo(() => {
    const map = new Map<string, Reminder[]>();
    for (const r of data ?? []) {
      const key = dayKey(new Date(r.remindAt));
      const list = map.get(key) ?? [];
      list.push(r);
      map.set(key, list);
    }
    return map;
  }, [data]);

  const cells = useMemo(() => buildMonthGrid(cursor), [cursor]);

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

  const selectedList = selectedDay ? (byDay.get(selectedDay) ?? []) : [];
  const monthLabel = cursor.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Takvim</h1>
          <p className="text-slate-600">
            Hatırlatıcılar ve son başvuru tarihleri · ICS indir (Google / Outlook)
          </p>
        </div>
        <button
          type="button"
          onClick={() => void downloadIcs()}
          className="rounded-lg border px-3 py-2 text-sm"
        >
          .ics indir
        </button>
      </div>

      <div className="rounded-xl border bg-white/80 p-4">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            className="rounded border px-2 py-1 text-sm"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          >
            ←
          </button>
          <p className="font-medium capitalize">{monthLabel}</p>
          <button
            type="button"
            className="rounded border px-2 py-1 text-sm"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          >
            →
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-500">
          {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((d) => (
            <div key={d} className="py-1">
              {d}
            </div>
          ))}
          {cells.map((cell, i) => {
            if (!cell) return <div key={`e-${i}`} />;
            const key = dayKey(cell);
            const has = (byDay.get(key)?.length ?? 0) > 0;
            const isSel = selectedDay === key;
            const isToday = key === dayKey(new Date());
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedDay(key)}
                className={`relative rounded-lg py-2 text-sm ${
                  isSel
                    ? 'bg-accent text-white'
                    : isToday
                      ? 'bg-teal-50 text-ink'
                      : 'hover:bg-panel'
                }`}
              >
                {cell.getDate()}
                {has && (
                  <span
                    className={`absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full ${
                      isSel ? 'bg-white' : 'bg-accent'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
        {selectedDay && (
          <div className="mt-4 border-t pt-3 text-sm">
            <p className="mb-2 font-medium">
              {new Date(selectedDay).toLocaleDateString('tr-TR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </p>
            {selectedList.length ? (
              <ul className="space-y-2">
                {selectedList.map((r) => (
                  <li key={r.id} className="rounded-lg bg-panel px-3 py-2">
                    <p className="font-medium">{r.title}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(r.remindAt).toLocaleTimeString('tr-TR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-500">Bu günde hatırlatıcı yok.</p>
            )}
          </div>
        )}
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
          disabled={!title || !remindAt}
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
        {!data?.length && (
          <li className="text-sm text-slate-500">Henüz hatırlatıcı yok. Yukarıdan ekleyebilirsin.</li>
        )}
      </ul>
    </div>
  );
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Monday-first month grid (42 cells). */
function buildMonthGrid(monthStart: Date): Array<Date | null> {
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let startPad = (first.getDay() + 6) % 7; // Mon=0
  const cells: Array<Date | null> = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
