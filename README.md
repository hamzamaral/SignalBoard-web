# SignalBoard Web

React UI for [SignalBoard-api](https://github.com/hamzamaral/SignalBoard-api) — listing aggregator dashboard (public + private), pipeline, profile matching, reminders, admin settings.

## Stack

- React 18 + Vite + TypeScript
- TanStack Query, React Router 6, Axios (refresh queue)
- Tailwind CSS

## Quick start

```bash
npm install
npm run dev
```

Dev server: http://localhost:5173 (proxies `/api` → `http://localhost:3000`)

Requires API running (see SignalBoard-api README).

Demo login: `admin@signalboard.local` / `Admin123!`
