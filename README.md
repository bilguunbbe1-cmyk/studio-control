# Studio Control

Fully functional project/production control dashboard — Node/Express + SQLite backend,
React (Vite) frontend, JWT email+password auth. Deploy-ready for Render (backend) +
Vercel or Render Static (frontend).

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
Runs on http://localhost:4000. On first boot it creates `data.sqlite`, seeds sample
projects/approvals/deadlines, and creates a demo login:

```
email: demo@studio.mn
password: demo1234
```

**Frontend**
```bash
cd frontend
npm install
cp .env.example .env       # VITE_API_URL=http://localhost:4000
npm run dev
```
Runs on http://localhost:5173.

## What's functional

- Email+password auth (bcrypt + JWT, 7-day tokens), register + login screens
- Projects: list, create, and adjust spend — status (on track / at risk / late) is
  recalculated server-side from spend %
- Approvals: approve/reject persists to the database and removes the item from the queue
- Deadlines: listed from the database, soonest first
- Summary stats (budget, spent, remaining, margin) computed live from real project rows

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
   so `data.sqlite` survives deploys.
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
- Add role-based permissions (the `role` column on `users` is there but unused beyond
  storage — currently any logged-in user can approve/reject and create projects).
- Add password reset / email verification.
- Rate-limit `/api/auth/login` to slow down brute-force attempts.
