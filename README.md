# Viral Pixel — Project Control

Fully functional studio/production management dashboard — Node/Express + SQLite backend,
React (Vite + React Router) frontend, JWT email+password auth with three role tiers
(CEO, Manager, Production). UI/logic modeled on the "Viral Pixel — Project Control" reference
design, backed by a real database instead of static demo content.

## Roles

| Role       | Can do |
|------------|--------|
| **CEO**       | Everything — approve/reject decisions, create/edit projects, adjust spend, view full financials, see salary amounts, manage employees |
| **Manager**   | Same as CEO except cannot see actual salary ₮ amounts (only dates/status) |
| **Production** | View projects (no budget figures), see the full Production board, manage their own tasks in "Миний ажил", no access to Finance or salary amounts |

Financial figures (budget, spend, margin, revenue, cost line-item amounts) and salary amounts
are stripped **server-side** for restricted roles — not just hidden in the UI — so there's no
way to see them by inspecting network requests either.

Demo logins (seeded automatically on first boot):
```
CEO:        demo@studio.mn        / demo1234   (Пүрэвцэрэн)
Manager:    manager@studio.mn     / manager1234  (Гэрэлээ)
Production: production@studio.mn  / production1234  (Тэмүүлэн)
```

## Structure

```
studio-control/
  backend/     Express API + SQLite database (better-sqlite3)
  frontend/    React (Vite) dashboard, talks to the API
```

## Run locally

**Backend**
```bash
cd backend
npm install
cp .env.example .env      # edit JWT_SECRET to something random
npm run dev                # or: node server.js
```
Runs on http://localhost:4000. On first boot it creates `data.sqlite` and seeds 4 projects,
6 employees (with contracts/leave/payroll), tasks, decisions, and blockers.

**Frontend**
```bash
cd frontend
npm install
cp .env.example .env       # VITE_API_URL=http://localhost:4000
npm run dev
```
Runs on http://localhost:5173.

## Pages

- **Тойм (Overview)** — role-tailored landing page: CEO gets a company dashboard (alert
  banner, KPI cards, project oversight table, decisions queue, profitability, doc-completion,
  deadlines); Manager gets a personal "today's plan" (own projects, mandatory checklist);
  Production gets the Production board
- **Төслүүд (Projects)** — searchable/filterable card grid; opens a 6-tab detail slide-over
  (Тойм / Төлөвлөгөө / Продакшн / Review / Санхүү / Файл) per project
- **Миний ажил (My Work)** — the logged-in user's own tasks, filterable by status, with a
  "Шалгуулах →" action that submits a task for internal review
- **Продакшн (Production)** — 6-stage kanban board (Pre-production → Final) for the whole team
- **Санхүү (Finance)** — CEO/Manager only, gated server-side too; company-wide KPIs, per-project
  profit table, undocumented-expense list
- **Баг (Team)** — workload view (avatar, title, workload %, active/overdue task counts)
- **Ажилтнууд (Employees)** — HR roster; opens a 5-tab detail slide-over (Ерөнхий /
  Хөдөлмөрийн гэрээ / Амралт / Цалин / Файл) — the Цалин (Salary) tab redacts ₮ amounts for
  everyone except CEO

## What's functional

- Email+password auth (bcrypt + JWT, 7-day tokens)
- Three role tiers enforced **server-side** on every route — see `backend/middleware/auth.js`
  and the per-domain files under `backend/routes/`
- Projects: create, adjust spend, toggle checklist items, add deliverables/cost items/review
  items, upload files — all persisted
- Tasks: kanban stage moves, status transitions, "submit for review" action, ownership checks
- Decisions: approve/reject/override, persisted with decider + timestamp
- Employees: full HR record (contract, leave cycle, payroll schedule) with role-gated salary
  visibility
- Global search (⌕) and a notifications panel (♢) backed by real queries

All data lives in `backend/data.sqlite` — nothing is hardcoded in the frontend.

## Deploying

### Backend → Render (recommended for SQLite)
SQLite needs a real, persistent disk — Vercel's serverless functions won't work for it
since their filesystem is read-only/ephemeral. Render's free/starter web services support
persistent disks, so it's the easiest fit here.

1. Push this repo to GitHub.
2. On Render: **New → Web Service**, point at the repo, root directory `backend`.
   - Build command: `npm install`
   - Start command: `node server.js`
3. Add a **persistent disk** (Render dashboard → Disks) mounted at e.g. `/opt/render/project/src/backend`
   so `data.sqlite` and `uploads/` survive deploys.
4. Set environment variables: `JWT_SECRET` (long random string), `PORT` (Render sets this
   automatically — don't override).
5. Note the deployed URL, e.g. `https://studio-control-api.onrender.com`.

### Frontend → Vercel (or Render Static Site / Netlify)
1. Push the same repo (or just the `frontend` folder) — root directory `frontend`.
2. Build command: `npm run build`, output directory: `dist`.
3. Set env var `VITE_API_URL` to your deployed backend URL from above.
4. Deploy.

### CORS
The backend currently allows all origins (`cors()` with no options) so this works out of
the box. Once you know your frontend's production URL, tighten it in `backend/server.js`:

```js
app.use(cors({ origin: "https://your-frontend-domain.com" }));
```

## Next steps worth considering
- Move from SQLite to Postgres if you expect concurrent writes at scale (swap
  `better-sqlite3` for `pg` — the route logic stays basically the same).
- Add password reset / email verification.
- Rate-limit `/api/auth/login` to slow down brute-force attempts.
- Drag-and-drop for the Production kanban (currently move-by-button).
