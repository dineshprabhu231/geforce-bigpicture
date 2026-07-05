# Big Picture for GeForce NOW

A controller-friendly "Big Picture" launcher for your GeForce NOW game shortcuts — browse your library from the couch and launch straight into GeForce NOW with an Xbox or PlayStation controller, no mouse or keyboard required.

GeForce NOW lets you create desktop shortcuts for individual games, but there's no TV-friendly, controller-driven way to browse just the games you play. This app fills that gap: it never touches the GeForce NOW client itself, it only reads the shortcuts you already have and asks Windows to open them — exactly like double-clicking would.

## What it does

- Import a folder of GeForce NOW shortcuts (`.gfnpc` / `.url` / `.lnk`) and browse them as a horizontal, TV-friendly row of tiles
- Navigate entirely with a controller — D-pad, left stick, or arrow keys as a fallback
- Launch a game, mark favorites, remove shortcuts you don't want, and set custom artwork per tile
- Automatic box art via [SteamGridDB](https://www.steamgriddb.com), fetched through this project's own small backend so end users never need their own API key
- Bottom control-hint bar that shows the right button glyphs for whatever you're actually using (Xbox, PlayStation, or keyboard) and switches instantly when you switch input methods
- Optional auto-launch straight into fullscreen when Windows starts

## Project structure

This is two separate pieces that work together:

```
.
├── frontend/   the Electron + React desktop app (what you actually run and see)
└── backend/    a tiny Express server that holds the SteamGridDB API key
```

They're split up because the SteamGridDB API key has to live somewhere other than inside an app that gets distributed to other people's computers. The backend is the only thing that ever talks to SteamGridDB directly; the frontend just calls the backend.

- **`frontend/README.md`** — full details on running, building, and how shortcut scanning/launching works
- **`backend/README.md`** — full details on deploying the artwork server to Railway or Vercel

## Quick start (local dev)

You need two terminals — one for each half.

**Terminal 1 — backend:**
```bash
cd backend
npm install
cp .env.example .env
# edit .env and paste in a free key from
# https://www.steamgriddb.com/profile/preferences/api
npm start
```

**Terminal 2 — frontend:**
```bash
cd frontend
npm install
npm run dev
```

The frontend automatically talks to the backend on `http://localhost:3000` in dev mode — no extra configuration needed. This opens the Electron app with DevTools attached.

## Controls

| Action | Xbox | PlayStation | Keyboard |
|---|---|---|---|
| Navigate | D-pad / left stick | D-pad / left stick | Arrow keys |
| Launch | A | ✕ | Enter |
| Favorite | X | □ | Space |
| Set artwork | Y | △ | I |

The hint bar at the bottom always shows whichever of these you used most recently.

## Tech stack

- **Frontend:** Electron, React, Tailwind CSS, Vite
- **Controller input:** the browser Gamepad API
- **Local storage:** `electron-store` (JSON, on-disk, per-user)
- **Backend:** Node.js, Express, deployable to Railway or Vercel
- **Artwork:** [SteamGridDB API](https://www.steamgriddb.com/api/v2)

## Requirements

- Windows 10/11 (shortcut scanning and launching use Windows-specific paths and `shell.openPath`)
- [Node.js](https://nodejs.org) 18+

## Building a distributable

```bash
cd frontend
npm run build
```

Produces a Windows installer in `frontend/release/` via `electron-builder`. Before shipping to other people, deploy `/backend` (see `backend/README.md`) and point the frontend at that deployed URL — see `frontend/.env.example`.

## Design principles

- **Never modify GeForce NOW.** This app only reads existing shortcut files and hands them to the OS to open — it never launches the GeForce NOW executable directly with constructed arguments, so it can't drift out of sync with how NVIDIA's own client expects to be started.
- **No system-wide scanning.** Shortcuts are only added when you explicitly import a folder or add a file — nothing crawls your whole Desktop or Start Menu in the background.
- **Removals stick.** Removing a game from the list is remembered even if you rescan or re-import the same folder later.

## License

MIT
