// Talks to our own small hosted proxy (see the sibling /backend folder)
// instead of SteamGridDB directly. That server holds the SteamGridDB API
// key as a secret env var, so people using this app never need to get or
// paste in their own key.
//
// Deploy /backend to Railway or Vercel (see backend/README.md) for a real
// build, then set ARTWORK_SERVER_URL to whatever URL that gives you. In dev
// mode (npm run dev), if you haven't set it, we default to the backend
// running locally on :3000 — so `cd backend && npm start` in one terminal
// and `cd frontend && npm run dev` in another just works out of the box.
const isDev = process.env.NODE_ENV === 'development';
const ARTWORK_SERVER_URL =
  process.env.ARTWORK_SERVER_URL || (isDev ? 'http://localhost:3000' : 'https://REPLACE-WITH-YOUR-DEPLOYED-URL');

// Only needed if you set CLIENT_SECRET on the server too — leave both
// blank to run against an open server.
const CLIENT_SECRET = process.env.ARTWORK_CLIENT_SECRET || '';

// GeForce NOW names its shortcuts like "DEATHLOOP® on GeForce NOW" — that
// suffix and the trademark symbols mean nothing to SteamGridDB and just
// make the search miss. Clean it up here, right before the lookup, without
// touching the name shown anywhere else in the app.
function cleanNameForSearch(name) {
  return name
    .replace(/\s*on\s+GeForce\s+NOW\s*$/i, '')
    .replace(/[®™©]/g, '')
    .trim();
}

// Looks up a game by name via our artwork server and returns it as a
// base64 data URL ready to store as `game.image`. Returns null if nothing
// matched — that's a normal "no artwork found" outcome, not an error.
async function fetchArtworkForName(name) {
  const query = cleanNameForSearch(name);
  const url = `${ARTWORK_SERVER_URL.replace(/\/$/, '')}/artwork?name=${encodeURIComponent(query)}`;
  console.log(`[artwork] requesting: ${url}`);

  let res;
  try {
    res = await fetch(url, {
      headers: CLIENT_SECRET ? { 'x-app-secret': CLIENT_SECRET } : {},
    });
  } catch (err) {
    console.log(`[artwork] network error reaching server: ${err.message}`);
    throw new Error("Couldn't reach the artwork server. Check your internet connection.");
  }

  console.log(`[artwork] server responded: ${res.status}`);

  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Artwork server request failed (${res.status})`);

  const data = await res.json();
  console.log(`[artwork] result:`, data.ok ? 'found image' : data.error);
  if (!data.ok) throw new Error(data.error || 'Artwork lookup failed.');
  return data.image;
}

module.exports = { fetchArtworkForName };
