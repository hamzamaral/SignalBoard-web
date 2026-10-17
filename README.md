# SignalBoard Web

React UI for [SignalBoard-api](https://github.com/hamzamaral/SignalBoard-api) — listing aggregator, applications pipeline, profile matching, calendar reminders, admin tools.

## Screenshots / flow

```
Login → Özet (öneriler + yaklaşan hatırlatıcılar)
      → Kamu / Özel (ilan listesi)
      → İlan detayı (tarihler, kadro tablosu; özet scrape’de uyarı)
      → Başvurularım (İnceleme → Başvurulacak → Başvuruldu → …)
      → Takvim (ay görünümü + .ics)
      → Profil (KPSS / yetkinlik)
      → Admin (yapıştır kamu|özel, SMTP, LLM, kaynak tarama)
```

### Admin notları

| Bölüm | Ne işe yarar |
|-------|----------------|
| İlan yapıştır | Kamu **veya** özel tam metin → ayrıştır / kaydet |
| SMTP | Uygun ilan e-postası (key GitHub’da yok) |
| LLM | Ollama varsayılan; Gemini/Groq isteğe bağlı |
| Kaynaklardan topla | ilan.gov / Kamu İlan / Yerel Yönetimler (özet; detay için paste) |

### Başvuru durumları (UI)

Yeni · İnceleme · Başvurulacak · Başvuruldu · Sonuç bekleniyor · Kapandı · Başvurulamaz

## Stack

React 18 · Vite · TypeScript · TanStack Query · React Router 6 · Tailwind · Axios (refresh queue)

## Quick start

```bash
npm install
npm run dev
```

http://localhost:5173 (proxies `/api` → `http://localhost:3000`)

Requires API running. Demo: `admin@signalboard.local` / `Admin123!`
