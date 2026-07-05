# Big Picture for GeForce NOW

A controller-friendly Big Picture launcher for your GeForce NOW game shortcuts.
It never touches the GeForce NOW client itself — it only reads your existing
shortcut files and asks Windows to open them, exactly like a double-click would.

## What's in this MVP

- **+ Import folder** — point it at any folder and it adds every
  `.gfnpc`/`.url`/`.lnk` file inside (one level deep, including subfolders).
  Since you picked that folder specifically for GeForce NOW shortcuts, every
  shortcut in it is trusted directly — no content re-validation. This folder
  is remembered, and **Rescan** re-checks only it — there's no broader
  auto-scan of Desktop/Public Desktop/Start Menu
- **+ Add shortcut** — manual fallback for a single file anywhere else
- Favoriting a game (**X** / **□** / **Space**) pins it to the front of the
  row, in the order you favorited things — unfavorite and it drops back into
  its normal spot
- **Automatic artwork** via [SteamGridDB](https://www.steamgriddb.com), fetched
  through this app's own small backend (see `/backend`) so you never need
  your own API key day-to-day — whoever hosts that backend adds the key
  once. Use the 🔍 button on a tile (or "Fetch artwork" in the header) to
  pull box art automatically, matched by shortcut name. Manually-set artwork
  (🖼) is never overwritten by auto-fetch
- Hover any tile (or press the artwork shortcut on it) to reveal a ✕ button
  that removes it from the list — this never touches the shortcut file
  itself, and the removal sticks even after a rescan or re-import
- A single horizontal row of tiles, vertically centered — navigate left/right
  with the D-pad, left stick, or arrow keys
- **A** / **✕** / **Enter** launches the focused game
- **X** / **□** / **Space** toggles favorite
- **Y** / **△** / **I** — or the 🖼 button that appears on hover — sets a
  custom image for the focused tile
- The bottom control-hint bar tracks whichever input you used *last*, so it
  switches back to keyboard glyphs the instant you press a key, even after
  using a controller earlier in the session

Favorites/Collections filtering, search, automatic artwork lookup, themes,
and cloud sync are intentionally left out of this pass — the scaffolding
(data store, IPC layer, row) is built so those slot in without restructuring
anything.

## Requirements

- Windows 10/11 recommended (shortcut launching uses `shell.openPath`,
  which is most useful for `.lnk`/`.url`/`.gfnpc` files on Windows)
- [Node.js](https://nodejs.org) 18+ installed

## Running it locally

This app is two pieces: this `frontend` folder (the Electron app) and the
`backend` folder next to it (a small artwork-lookup server). For local dev
you run both, in two terminals:

**Terminal 1 — backend:**
```bash
cd backend
npm install
# Add your SteamGridDB key (see backend/README.md) — get a free one at
# https://www.steamgriddb.com/profile/preferences/api
cp .env.example .env
# then edit .env and paste your key into STEAMGRIDDB_API_KEY=

npm start
```
You should see `Artwork server listening on :3000`. If you skip the `.env`
step you'll also see a `Missing STEAMGRIDDB_API_KEY` warning — that's not
fatal, the server still runs, but artwork lookups will fail (404/"no
artwork found") until a real key is set.

**Terminal 2 — frontend:**
```bash
cd frontend
npm install
npm run dev
```
This starts the Vite dev server and opens the Electron window pointed at
it, with DevTools open for debugging. In dev mode the app talks to the
backend on `http://localhost:3000` automatically — no configuration needed
unless you want to point it at a deployed backend instead (see
`.env.example` in this folder).

## Building a distributable

```bash
npm run build
```

Produces an installer in `release/` via `electron-builder` (NSIS installer
for Windows). Swap in your own `public/icon.ico` before shipping. Before
building for real users, also deploy `/backend` somewhere (Railway/Vercel —
see `backend/README.md`) and set `ARTWORK_SERVER_URL` in a `.env` file here
to that deployed URL, since `localhost:3000` won't exist on anyone else's
machine.

## How discovery works

There's no background or automatic scanning of your Desktop, Start Menu, or
anywhere else on disk. Shortcuts only ever get added two ways:

1. **+ Import folder** — you pick a folder, and every `.gfnpc`/`.url`/`.lnk`
   file inside it (one level deep, including subfolders) is added. Since you
   picked that folder specifically for GeForce NOW shortcuts, everything in
   it is trusted directly — no content inspection of the file itself.
2. **+ Add shortcut** — add one specific file from anywhere.

The last folder you used with **+ Import folder** is remembered. **Rescan**
re-checks only that one folder (to pick up shortcuts you've added or removed
there since) — it never looks anywhere else. If you haven't imported a
folder yet, Rescan does nothing.

On rescan, favorites, custom artwork, and manually-added games are preserved
by matching on file path. Removing a game records its path so it won't
silently come back on the next rescan or re-import.

Launching a game calls `shell.openPath()` on the shortcut file, i.e. the same
thing Windows Explorer does on double-click. The app never launches the
GeForce NOW executable directly with constructed arguments, so it can't drift
out of sync with how NVIDIA's own client expects to be started.

## Next steps (not built yet)

- Favorites/Collections filtering in the UI (the `favorite` field already
  exists in the store)
- Search-as-you-type
- Auto-launch fullscreen on Windows boot (`app.setLoginItemSettings` +
  a `--fullscreen` launch flag)
- Icon extraction from the `.lnk`/`.gfnpc` for nicer tiles without needing
  a SteamGridDB match
