export type PageListing = {
  name: string;
  applied: boolean;
};

export function CompanyChartButton({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={open}
      onClick={onToggle}
      className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50"
    >
      {open ? 'Grafiği gizle' : 'Firma grafiği'}
    </button>
  );
}

export function CompanyApplicationChart({ rows }: { rows: PageListing[] }) {
  const firms = groupPage(rows);
  const appliedFirms = firms.filter((firm) => firm.applied).length;
  const max = Math.max(1, ...firms.map((firm) => firm.listings));

  return (
    <section className="border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-800">Bu sayfadaki firmalar</h2>
      {firms.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">Bu sayfada listelenen ilan yok.</p>
      ) : (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-slate-700">
            Sayfada <span className="font-semibold">{firms.length}</span> firma var.{' '}
            <span className="font-semibold">{appliedFirms}</span> firmaya başvurdun.
          </p>
          <ul className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
            {firms.map((firm) => (
              <li
                key={firm.name}
                className="grid grid-cols-[minmax(8rem,16rem)_1fr_auto] items-center gap-3"
              >
                <span className="truncate text-sm" title={firm.name}>
                  <span className={firm.applied ? 'font-medium' : 'text-slate-600'}>{firm.name}</span>
                  {firm.applied && (
                    <span className="mt-0.5 block text-xs text-accent">başvurdun</span>
                  )}
                </span>
                <div className="h-3 bg-slate-100" aria-hidden>
                  <div
                    className={`h-3 ${firm.applied ? 'bg-accent' : 'bg-slate-300'}`}
                    style={{ width: `${Math.max(8, Math.round((firm.listings / max) * 100))}%` }}
                  />
                </div>
                <span className="text-right text-sm tabular-nums text-slate-700">{firm.listings}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function groupPage(rows: PageListing[]) {
  const firms = new Map<string, { name: string; listings: number; applied: boolean }>();
  for (const row of rows) {
    const name = row.name.trim() || 'Kurum belirtilmemiş';
    const key = name.toLocaleLowerCase('tr-TR');
    const current = firms.get(key) ?? { name, listings: 0, applied: false };
    current.listings += 1;
    current.applied = current.applied || row.applied;
    firms.set(key, current);
  }
  return [...firms.values()].sort(
    (a, b) => b.listings - a.listings || a.name.localeCompare(b.name, 'tr'),
  );
}
