# SignalBoard Web — Agent Handoff

> Pair with `../SignalBoard-api/AGENT_HANDOFF.md` (or https://github.com/hamzamaral/SignalBoard-api/blob/main/AGENT_HANDOFF.md).

## Purpose

React SPA for SignalBoard: public/private listings, pipeline, profile (KPSS/skills), recommendations dashboard, reminders + ICS download, admin (paste-parse, SMTP, LLM, ingest).

Neutral product language — not “job hunt” branding.

## Local

- Path: `C:\github\SignalBoard-web`
- Dev: `npm run dev` → http://localhost:5173
- Proxy: `/api` → `http://localhost:3000`

## Stack

React 18, Vite 5, TS, TanStack Query, React Router 6, Axios (single-flight refresh), Tailwind, sonner.

## Routes

- `/login`
- `/` dashboard (recommendations + reminders)
- `/listings` public, `/private` private
- `/pipeline`, `/profile`, `/reminders`
- `/admin` (ADMIN only): paste-parse, SMTP, LLM, ingest

## Auth

`AuthProvider` + `tokenStorage` + `ProtectedRoute`. API base `/api/v1`.

## Completed

- [x] Auth, layout, core pages, admin panel
- [x] Production build OK

## Remaining

- [ ] Stronger empty/loading/error UX
- [ ] Institutions admin CRUD UI
- [ ] Docker/nginx image for static hosting
- [ ] Component tests

## Demo

admin@signalboard.local / Admin123! (API must be seeded)
