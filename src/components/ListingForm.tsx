import type { Listing } from '@/types/api';

export type ListingFormValues = {
  title: string;
  institutionName: string;
  city: string;
  position: string;
  url: string;
  kind: 'PUBLIC' | 'PRIVATE';
  status: 'DRAFT' | 'OPEN' | 'CLOSED' | 'CANCELLED';
  publishedAt: string;
  applyStartAt: string;
  applyEndAt: string;
  examAt: string;
  resultAnnounceAt: string;
  description: string;
};

const emptyForm = (): ListingFormValues => ({
  title: '',
  institutionName: '',
  city: '',
  position: '',
  url: '',
  kind: 'PUBLIC',
  status: 'OPEN',
  publishedAt: '',
  applyStartAt: '',
  applyEndAt: '',
  examAt: '',
  resultAnnounceAt: '',
  description: '',
});

export function emptyListingForm(kind: ListingFormValues['kind'] = 'PUBLIC'): ListingFormValues {
  return { ...emptyForm(), kind };
}

export function listingToForm(listing: Listing): ListingFormValues {
  return {
    title: listing.title ?? '',
    institutionName: listing.institution?.name ?? '',
    city: listing.city ?? '',
    position: listing.position ?? '',
    url: listing.url ?? '',
    kind: listing.kind === 'PRIVATE' ? 'PRIVATE' : 'PUBLIC',
    status: isStatus(listing.status) ? listing.status : 'OPEN',
    publishedAt: dateInput(listing.publishedAt),
    applyStartAt: dateInput(listing.applyStartAt),
    applyEndAt: dateInput(listing.applyEndAt),
    examAt: dateInput(listing.examAt),
    resultAnnounceAt: dateInput(listing.resultAnnounceAt),
    description: listing.description ?? listing.rawText ?? '',
  };
}

export function formToBody(values: ListingFormValues, mode: 'create' | 'edit') {
  const url = normalizeUrl(values.url);
  const body: Record<string, unknown> = {
    title: values.title.trim(),
    kind: values.kind,
    status: values.status,
    institutionName: values.institutionName.trim() || undefined,
    city: textField(values.city, mode),
    position: textField(values.position, mode),
    description: textField(values.description, mode),
    url,
  };
  if (mode === 'create') {
    body.source = values.kind === 'PRIVATE' ? 'PRIVATE' : 'MANUAL';
  }
  for (const key of [
    'publishedAt',
    'applyStartAt',
    'applyEndAt',
    'examAt',
    'resultAnnounceAt',
  ] as const) {
    const value = values[key];
    if (value) body[key] = value;
    else if (mode === 'edit') body[key] = '';
  }
  return body;
}

export function ListingForm({
  mode,
  values,
  onChange,
  onSubmit,
  pending,
}: {
  mode: 'create' | 'edit';
  values: ListingFormValues;
  onChange: (values: ListingFormValues) => void;
  onSubmit: () => void;
  pending?: boolean;
}) {
  function set<K extends keyof ListingFormValues>(key: K, value: ListingFormValues[K]) {
    onChange({ ...values, [key]: value });
  }

  return (
    <form
      className="mt-3 grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <label className="block text-sm sm:col-span-2">
        <span className="mb-1 block text-slate-600">Başlık</span>
        <input
          required
          minLength={3}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          value={values.title}
          onChange={(e) => set('title', e.target.value)}
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-slate-600">Kurum / firma</span>
        <input
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          value={values.institutionName}
          onChange={(e) => set('institutionName', e.target.value)}
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-slate-600">Pozisyon</span>
        <input
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          value={values.position}
          onChange={(e) => set('position', e.target.value)}
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-slate-600">Şehir</span>
        <input
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          value={values.city}
          onChange={(e) => set('city', e.target.value)}
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-slate-600">Tür</span>
        <select
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          value={values.kind}
          onChange={(e) => set('kind', e.target.value as ListingFormValues['kind'])}
        >
          <option value="PUBLIC">Kamu</option>
          <option value="PRIVATE">Özel</option>
        </select>
      </label>
      <label className="block text-sm sm:col-span-2">
        <span className="mb-1 block text-slate-600">Kaynak adresi</span>
        <input
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          placeholder="https://…"
          value={values.url}
          onChange={(e) => set('url', e.target.value)}
        />
      </label>
      <DateField label="İlan tarihi" value={values.publishedAt} onChange={(v) => set('publishedAt', v)} />
      <DateField label="Başvuru başlangıcı" value={values.applyStartAt} onChange={(v) => set('applyStartAt', v)} />
      <DateField label="Başvuru bitişi" value={values.applyEndAt} onChange={(v) => set('applyEndAt', v)} />
      <DateField label="Sınav" value={values.examAt} onChange={(v) => set('examAt', v)} />
      <DateField
        label="Sonuç açıklama"
        value={values.resultAnnounceAt}
        onChange={(v) => set('resultAnnounceAt', v)}
      />
      <label className="block text-sm">
        <span className="mb-1 block text-slate-600">Durum</span>
        <select
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          value={values.status}
          onChange={(e) => set('status', e.target.value as ListingFormValues['status'])}
        >
          <option value="OPEN">Açık</option>
          <option value="DRAFT">Taslak</option>
          <option value="CLOSED">Kapandı</option>
          <option value="CANCELLED">İptal</option>
        </select>
      </label>
      <label className="block text-sm sm:col-span-2">
        <span className="mb-1 block text-slate-600">Açıklama</span>
        <textarea
          className="min-h-24 w-full rounded border border-slate-300 p-3 text-sm"
          value={values.description}
          onChange={(e) => set('description', e.target.value)}
        />
      </label>
      <div>
        <button
          type="submit"
          disabled={pending || values.title.trim().length < 3}
          className="rounded bg-accent px-3 py-2 text-sm text-white disabled:opacity-50"
        >
          {pending ? 'Kaydediliyor…' : mode === 'create' ? 'İlanı ekle' : 'Değişiklikleri kaydet'}
        </button>
      </div>
    </form>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-slate-600">{label}</span>
      <input
        type="date"
        className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function dateInput(iso?: string | null) {
  if (!iso) return '';
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(iso);
  return match ? match[1] : '';
}

function isStatus(value: string): value is ListingFormValues['status'] {
  return value === 'DRAFT' || value === 'OPEN' || value === 'CLOSED' || value === 'CANCELLED';
}

function textField(value: string, mode: 'create' | 'edit') {
  const trimmed = value.trim();
  if (trimmed) return trimmed;
  return mode === 'edit' ? '' : undefined;
}

function normalizeUrl(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}
