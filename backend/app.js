// Small proxy in front of SteamGridDB. The SteamGridDB API key lives only
// on whatever platform this is deployed to (set as an environment
// variable) — it never ships inside the Electron app, so end users of GFN
// Launcher never need one of their own.
//
// This file just builds and exports the Express app. It's used two ways:
//   - index.js     starts it as a normal always-on server (Railway, local)
//   - api/index.js wraps it as a serverless function (Vercel)
//
// Endpoints:
//   GET /health              -> { ok: true }                      (uptime check)
//   GET /artwork?name=Halo   -> { ok: true, image: "data:...;base64,..." }
//
// Optional shared-secret gate: set CLIENT_SECRET here and
// ARTWORK_CLIENT_SECRET in the Electron app to the same value if you want
// to stop randoms from hammering your SteamGridDB quota. Leave both unset
// to run the server open.

// Loads a local .env file if one exists (for local dev / `npm start`).
// On Railway/Vercel this is a harmless no-op — those platforms inject real
// environment variables directly and there's no .env file present.
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
app.use(cors());
app.set('trust proxy', 1); // Railway/Vercel sit behind a proxy; needed for rate-limit to see real IPs

const STEAMGRIDDB_API_KEY = process.env.STEAMGRIDDB_API_KEY;
const CLIENT_SECRET = process.env.CLIENT_SECRET || '';

const SGDB_BASE = 'https://www.steamgriddb.com/api/v2';
const IMAGE_MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

if (!STEAMGRIDDB_API_KEY) {
  console.error(
    'Missing STEAMGRIDDB_API_KEY environment variable — set it in your Railway/Vercel project settings.'
  );
}

// Every client's lookups share this cache, so "Halo Infinite" only ever hits
// SteamGridDB once total, not once per person who owns the game. On Vercel
// this resets per cold-start rather than staying warm for a week like it
// does on Railway — still a net win, just a smaller one there.
const cache = new Map(); // lowercased name -> { image: string|null, expires: number }
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 1 week

// Keep any one caller from burning through the shared SteamGridDB quota.
const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60, // 60 requests/minute/IP is generous for a launcher's own use
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

function requireSecret(req, res, next) {
  if (!CLIENT_SECRET) return next(); // no secret configured -> open server
  if (req.get('x-app-secret') !== CLIENT_SECRET) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  next();
}

async function sgdbGet(pathname) {
  const res = await fetch(`${SGDB_BASE}${pathname}`, {
    headers: { Authorization: `Bearer ${STEAMGRIDDB_API_KEY}` },
  });
  if (!res.ok) throw new Error(`SteamGridDB request failed (${res.status})`);
  const data = await res.json();
  if (!data.success) throw new Error('SteamGridDB request was unsuccessful');
  return data;
}

// Looks up a game by (fuzzy) name, grabs its top portrait grid image, and
// returns it as a base64 data URL. Returns null if nothing matched — a
// normal "no artwork" outcome, not an error.
async function lookupArtwork(name) {
  const cacheKey = name.trim().toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.image;

  const remember = (image) => {
    cache.set(cacheKey, { image, expires: Date.now() + CACHE_TTL_MS });
    return image;
  };

  const search = await sgdbGet(`/search/autocomplete/${encodeURIComponent(name)}`);
  const match = search.data?.[0];
  if (!match) return remember(null);

  const grids = await sgdbGet(`/grids/game/${match.id}?dimensions=600x900`);
  const grid = grids.data?.[0];
  if (!grid?.url) return remember(null);

  const imgRes = await fetch(grid.url);
  if (!imgRes.ok) return remember(null);
  const buffer = Buffer.from(await imgRes.arrayBuffer());
  const ext = (grid.url.split('.').pop() || 'png').split('?')[0].toLowerCase();
  const mime = IMAGE_MIME[`.${ext}`] || 'image/png';

  return remember(`data:${mime};base64,${buffer.toString('base64')}`);
}

app.get('/health', (_req, res) => res.json({ ok: true }));

app.get('/artwork', requireSecret, async (req, res) => {
  const name = (req.query.name || '').toString().trim();
  console.log(`[artwork] request for: "${name}"`);
  if (!name) return res.status(400).json({ ok: false, error: 'Missing "name" query param.' });
  if (!STEAMGRIDDB_API_KEY) {
    return res.status(500).json({ ok: false, error: 'Server is missing its SteamGridDB API key.' });
  }

  try {
    const image = await lookupArtwork(name);
    console.log(`[artwork] "${name}" -> ${image ? 'found' : 'not found'}`);
    if (!image) return res.status(404).json({ ok: false, error: `No artwork found for "${name}".` });
    res.json({ ok: true, image });
  } catch (err) {
    console.log(`[artwork] "${name}" -> error: ${err.message}`);
    res.status(502).json({ ok: false, error: err.message });
  }
});

module.exports = app;
