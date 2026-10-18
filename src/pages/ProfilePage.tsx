import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { TagSelect } from '@/components/TagSelect';
import { api, getErrorMessage } from '@/lib/api';
import {
  CERTIFICATE_OPTIONS,
  SKILL_OPTIONS,
  TARGET_TITLE_OPTIONS,
} from '@/lib/profile-options';
import type { Profile } from '@/types/api';

export function ProfilePage() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => (await api.get<Profile>('/profile')).data,
  });

  const [form, setForm] = useState({
    education: '',
    preferredCity: '',
    kpssP3: '',
    kpssP93: '',
    skills: [] as string[],
    certificates: [] as string[],
    targetTitles: [] as string[],
    emailAlerts: true,
  });

  useEffect(() => {
    if (!data) return;
    setForm({
      education: data.education ?? '',
      preferredCity: data.preferredCity ?? '',
      kpssP3: String(data.kpssScores?.P3 ?? ''),
      kpssP93: String(data.kpssScores?.P93 ?? ''),
      skills: data.skills ?? [],
      certificates: data.certificates ?? [],
      targetTitles: data.targetTitles ?? [],
      emailAlerts: data.emailAlerts,
    });
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const kpssScores: Record<string, number> = {};
      if (form.kpssP3) kpssScores.P3 = Number(form.kpssP3);
      if (form.kpssP93) kpssScores.P93 = Number(form.kpssP93);
      await api.put('/profile', {
        education: form.education || undefined,
        preferredCity: form.preferredCity || undefined,
        kpssScores,
        skills: form.skills,
        certificates: form.certificates,
        targetTitles: form.targetTitles,
        emailAlerts: form.emailAlerts,
      });
    },
    onSuccess: () => {
      toast.success('Profil kaydedildi');
      void qc.invalidateQueries({ queryKey: ['profile'] });
      void qc.invalidateQueries({ queryKey: ['recommendations'] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Profil</h1>
        <p className="text-slate-600">KPSS, sertifika ve yetkinliklere göre öneri skoru hesaplanır</p>
      </div>
      <div className="space-y-4 rounded-xl border bg-white/80 p-5">
        <Field label="Öğrenim" value={form.education} onChange={(v) => setForm({ ...form, education: v })} />
        <Field
          label="Tercih edilen şehir"
          value={form.preferredCity}
          onChange={(v) => setForm({ ...form, preferredCity: v })}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="KPSS P3" value={form.kpssP3} onChange={(v) => setForm({ ...form, kpssP3: v })} />
          <Field label="KPSS P93" value={form.kpssP93} onChange={(v) => setForm({ ...form, kpssP93: v })} />
        </div>
        <TagSelect
          label="Yetkinlikler"
          options={SKILL_OPTIONS}
          value={form.skills}
          onChange={(skills) => setForm({ ...form, skills })}
        />
        <TagSelect
          label="Sertifikalar"
          options={CERTIFICATE_OPTIONS}
          value={form.certificates}
          onChange={(certificates) => setForm({ ...form, certificates })}
        />
        <TagSelect
          label="Hedef unvanlar"
          options={TARGET_TITLE_OPTIONS}
          value={form.targetTitles}
          placeholder="Zabıt katibi, İKM, hemşire…"
          onChange={(targetTitles) => setForm({ ...form, targetTitles })}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.emailAlerts}
            onChange={(e) => setForm({ ...form, emailAlerts: e.target.checked })}
          />
          E-posta bildirimleri
        </label>
        <button
          type="button"
          className="rounded-lg bg-accent px-4 py-2 text-white"
          onClick={() => save.mutate()}
        >
          Kaydet
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-sm">
      {label}
      <input
        className="mt-1 w-full rounded-lg border px-3 py-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
