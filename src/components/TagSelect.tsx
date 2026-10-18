import { useEffect, useId, useMemo, useRef, useState } from 'react';

function keyOf(value: string) {
  return value.trim().toLocaleLowerCase('tr-TR');
}

function fold(value: string) {
  return keyOf(value)
    .replaceAll('ı', 'i')
    .replaceAll('ş', 's')
    .replaceAll('ğ', 'g')
    .replaceAll('ü', 'u')
    .replaceAll('ö', 'o')
    .replaceAll('ç', 'c');
}

export type TagChoice = {
  label: string;
  group?: string;
  aliases?: string[];
  short?: string;
};

export function TagSelect({
  label,
  options,
  value,
  onChange,
  placeholder = 'Ara veya yeni ekle',
}: {
  label: string;
  options: Array<string | TagChoice>;
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const catalog = useMemo(() => {
    const seen = new Map<string, TagChoice>();
    for (const item of options) {
      const choice = typeof item === 'string' ? { label: item } : item;
      const trimmed = choice.label.trim();
      const key = keyOf(trimmed);
      if (!key || seen.has(key)) continue;
      seen.set(key, { ...choice, label: trimmed });
    }
    for (const current of value) {
      const trimmed = current.trim();
      const key = keyOf(trimmed);
      if (!key || seen.has(key)) continue;
      seen.set(key, { label: trimmed, group: 'Eklenen' });
    }
    return [...seen.values()];
  }, [options, value]);

  const needle = fold(query);
  const visible = catalog.filter((item) => {
    if (!needle) return true;
    const hay = [item.label, ...(item.aliases ?? [])].map(fold).join(' ');
    return hay.includes(needle);
  });
  const queryExists = catalog.some(
    (item) => fold(item.label) === needle || (item.aliases ?? []).some((alias) => fold(alias) === needle),
  );
  const groups = [...new Set(visible.map((item) => item.group).filter(Boolean))] as string[];
  const ungrouped = visible.filter((item) => !item.group);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  function isSelected(item: string) {
    const key = keyOf(item);
    return value.some((current) => keyOf(current) === key);
  }

  function toggle(item: string) {
    const key = keyOf(item);
    if (isSelected(item)) {
      onChange(value.filter((current) => keyOf(current) !== key));
      return;
    }
    onChange([...value, item.trim()]);
  }

  function addCustom() {
    const next = query.trim();
    if (!next) return;
    const exact = catalog.find(
      (item) =>
        fold(item.label) === needle || (item.aliases ?? []).some((alias) => fold(alias) === needle),
    );
    const pick = exact ?? (visible.length === 1 ? visible[0] : undefined);
    if (pick) {
      if (!isSelected(pick.label)) onChange([...value, pick.label]);
      setQuery('');
      return;
    }
    if (!isSelected(next)) onChange([...value, next]);
    setQuery('');
  }

  return (
    <div ref={rootRef} className="relative text-sm">
      <span className="block" id={`${listId}-label`}>
        {label}
      </span>
      <div
        role="group"
        aria-labelledby={`${listId}-label`}
        className="mt-1 flex min-h-[42px] w-full cursor-pointer flex-wrap items-center gap-1.5 rounded-lg border bg-white px-2 py-1.5 text-left"
        onClick={() => {
          const rect = rootRef.current?.getBoundingClientRect();
          setDropUp(rect ? window.innerHeight - rect.bottom < 320 : false);
          setOpen(true);
        }}
      >
        {value.length === 0 && <span className="px-1 text-slate-400">Seçin</span>}
        {value.map((item) => (
          <span
            key={keyOf(item)}
            className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-900"
          >
            {item}
            <button
              type="button"
              aria-label={`${item} kaldır`}
              className="text-teal-700 hover:text-teal-950"
              onClick={(event) => {
                event.stopPropagation();
                toggle(item);
              }}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      {open && (
        <div
          id={listId}
          className={`absolute z-20 w-full overflow-hidden rounded-lg border bg-white shadow-lg ${
            dropUp ? 'bottom-full mb-1' : 'mt-1'
          }`}
        >
          <input
            ref={searchRef}
            className="w-full border-b px-3 py-2 text-sm outline-none"
            placeholder={placeholder}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addCustom();
              }
              if (event.key === 'Escape') setOpen(false);
            }}
          />
          <ul className="max-h-80 overflow-auto py-1">
            {ungrouped.map((item) => (
              <OptionRow key={keyOf(item.label)} item={item} checked={isSelected(item.label)} onToggle={toggle} />
            ))}
            {groups.map((group) => (
              <li key={group}>
                <p className="sticky top-0 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {group}
                </p>
                <ul>
                  {visible
                    .filter((item) => item.group === group)
                    .map((item) => (
                      <OptionRow
                        key={keyOf(item.label)}
                        item={item}
                        checked={isSelected(item.label)}
                        onToggle={toggle}
                      />
                    ))}
                </ul>
              </li>
            ))}
            {!visible.length && !needle && (
              <li className="px-3 py-2 text-slate-500">Seçenek yok</li>
            )}
            {needle && !queryExists && (
              <li>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-accent hover:bg-slate-50"
                  onClick={addCustom}
                >
                  “{query.trim()}” ekle
                </button>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function OptionRow({
  item,
  checked,
  onToggle,
}: {
  item: TagChoice;
  checked: boolean;
  onToggle: (label: string) => void;
}) {
  return (
    <li>
      <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-slate-50">
        <input type="checkbox" checked={checked} onChange={() => onToggle(item.label)} />
        <span className="min-w-0 flex-1">{item.label}</span>
        {item.short && <span className="text-xs font-medium text-slate-400">{item.short}</span>}
      </label>
    </li>
  );
}
