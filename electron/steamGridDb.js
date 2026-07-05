// Thin wrapper around the SteamGridDB API (https://www.steamgriddb.com/api/v2)
// for automatic artwork lookup. The user supplies their own free API key —
// we never bundle one. Only ever reads public grid artwork; nothing is
// uploaded or written back to SteamGridDB.
const BASE = 'https://www.steamgriddb.com/api/v2';

const IMAGE_MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

async function apiGet(pathname, apiKey) {
  const res = await fetch(`${BASE}${pathname}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (res.status === 401) throw new Error('SteamGridDB rejected that API key');
  if (!res.ok) throw new Error(`SteamGridDB request failed (${res.status})`);
  const data = await res.json();
  if (!data.success) throw new Error('SteamGridDB request was unsuccessful');
  return data;
}

// Looks up a game by (fuzzy) name, grabs its top portrait grid image, and
// returns it as a base64 data URL ready to store as `game.image`. Returns
// null if nothing matched — that's a normal "no artwork found" outcome, not
// an error.
async function fetchArtworkForName(name, apiKey) {
  const search = await apiGet(`/search/autocomplete/${encodeURIComponent(name)}`, apiKey);
  const match = search.data?.[0];
  if (!match) return null;

  const grids = await apiGet(`/grids/game/${match.id}?dimensions=600x900`, apiKey);
  const grid = grids.data?.[0];
  if (!grid?.url) return null;

  const imgRes = await fetch(grid.url);
  if (!imgRes.ok) return null;
  const buffer = Buffer.from(await imgRes.arrayBuffer());
  const ext = (grid.url.split('.').pop() || 'png').split('?')[0].toLowerCase();
  const mime = IMAGE_MIME[`.${ext}`] || 'image/png';
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

module.exports = { fetchArtworkForName };
