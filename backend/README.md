# GFN Launcher — Artwork Server (backend)

A tiny Express proxy that sits in front of SteamGridDB. It holds the
SteamGridDB API key as a server-side secret, so people using GFN Launcher
never have to get or paste in their own key — the app calls this server,
and this server calls SteamGridDB.

This folder is a standalone project, separate from `../frontend` (the
Electron app). It can be deployed on its own to either **Railway** or
**Vercel** — pick whichever you prefer, both work with zero code changes.

## Endpoints

- `GET /health` → `{ "ok": true }` — for uptime checks
- `GET /artwork?name=Halo%20Infinite` → `{ "ok": true, "image": "data:image/png;base64,..." }`
  or `{ "ok": false, "error": "..." }`

Results are cached in memory per game name for a week, so popular games only
ever hit SteamGridDB once total across every user, not once per person.
(On Vercel this cache resets more often, since serverless functions don't
stay warm the way a Railway service does — still a net win, just a smaller
one there.)

## How this folder is laid out

```
backend/
├── app.js        the actual Express app — all the logic lives here
├── index.js      entry point for Railway/local: runs app.js as a normal server
├── api/
│   └── index.js  entry point for Vercel: wraps app.js as a serverless function
├── vercel.json   tells Vercel to route all requests through api/index.js
└── package.json
```
You never need to touch `api/index.js` or `vercel.json` unless you're
customizing the Vercel setup — they're just plumbing.

## Option A: Deploy to Railway

1. Push this `backend/` folder to its own GitHub repo (or a repo alongside
   `frontend/` — either works, see step 3).
2. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from
   GitHub repo** → select the repo.
3. If `backend/` lives inside a bigger repo (e.g. next to `frontend/`), open
   the new service's **Settings → Root Directory** and set it to `backend`.
4. Railway auto-detects Node from `package.json` and runs `npm start`
   (which runs `index.js`). No extra config needed.
5. Go to **Variables** and add:
   - `STEAMGRIDDB_API_KEY` — your key from
     https://www.steamgriddb.com/profile/preferences/api
   - `CLIENT_SECRET` *(optional)* — any random string, if you want to gate
     access so only your app can call this server. If you set this, set the
     matching `ARTWORK_CLIENT_SECRET` in the Electron app to the same value.
6. Under **Settings → Networking**, click **Generate Domain** to get a public
   URL like `https://your-app.up.railway.app`.
7. Confirm it's alive: visit `https://your-app.up.railway.app/health` — you
   should see `{"ok":true}`.

## Option B: Deploy to Vercel

1. Push this `backend/` folder to a GitHub repo (same as above — its own
   repo, or a subfolder of a bigger one).
2. Go to [vercel.com](https://vercel.com) → **Add New → Project** → import
   the repo.
3. If `backend/` lives inside a bigger repo, set **Root Directory** to
   `backend` in the import screen.
4. Vercel auto-detects it as a Node project. You don't need to change the
   build/output settings — `vercel.json` + `api/index.js` handle routing
   every request to the Express app.
5. Before deploying (or after, under **Settings → Environment Variables**),
   add:
   - `STEAMGRIDDB_API_KEY` — your key from SteamGridDB (see above)
   - `CLIENT_SECRET` *(optional)* — same idea as the Railway version
6. Deploy. Vercel gives you a URL like `https://your-app.vercel.app`.
7. Confirm it's alive: visit `https://your-app.vercel.app/health` — you
   should see `{"ok":true}`.

## Either way: point the app at it

For local dev this isn't needed — the frontend defaults to
`http://localhost:3000` automatically. Once you deploy, copy
`frontend/.env.example` to `frontend/.env` and set `ARTWORK_SERVER_URL` to
whichever URL you got (Railway or Vercel — the app doesn't care which), plus
`ARTWORK_CLIENT_SECRET` if you set `CLIENT_SECRET` above.

## Local testing

```bash
cp .env.example .env   # fill in STEAMGRIDDB_API_KEY
npm install
npm start
curl "http://localhost:3000/artwork?name=Portal%202"
```

## Notes

- Node 18+ is required (uses the built-in global `fetch`).
- Railway keeps the process warm between requests, so the in-memory cache
  and rate limiter behave exactly as described. Vercel's serverless model
  means a cold start now and then resets the cache — functionally fine,
  just slightly less effective caching.
- The rate limiter (60 requests/min/IP) and cache both help keep SteamGridDB
  usage well within a free API key's limits even with many users.
