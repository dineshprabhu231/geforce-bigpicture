const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const { scanSpecificFolder } = require('./shortcutScanner');
const { fetchArtworkForName } = require('./steamGridDb');
const { getStore } = require('./store');

const IMAGE_MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

const isDev = process.env.NODE_ENV === 'development';
let mainWindow;
const store = getStore();

// True when Windows started this app for us via the login-item registration
// below (we pass this flag ourselves in setLoginItemSettings), or when
// Electron/macOS reports it was opened at login. Either way it means "no
// human clicked an icon" — the signal we use to jump straight into
// fullscreen Big Picture mode instead of a normal windowed launch.
function launchedAtStartup() {
  if (process.argv.includes('--autostart')) return true;
  try {
    return !!app.getLoginItemSettings().wasOpenedAtLogin;
  } catch {
    return false;
  }
}

function createWindow() {
  const startFullscreen = launchedAtStartup();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#0A0C10',
    autoHideMenuBar: true,
    fullscreen: startFullscreen,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

// Registers (or unregisters) the app to run when Windows logs in. The
// '--autostart' arg is how the freshly-launched process recognizes it was
// opened this way, so it knows to boot straight into fullscreen.
function applyAutoLaunch(enabled) {
  if (process.platform !== 'win32') return; // login-item args are Windows-only
  app.setLoginItemSettings({
    openAtLogin: enabled,
    args: enabled ? ['--autostart'] : [],
  });
}

app.whenReady().then(() => {
  // Re-assert the login-item registration on every boot so it stays correct
  // even if the user reinstalled/moved the app since last setting it.
  applyAutoLaunch(store.get('autoLaunch', false));

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ---- IPC: library management -------------------------------------------

// Re-checks only the single folder previously chosen via "+ Import folder"
// (there's no more broad Desktop/Start Menu auto-scan). If no folder has
// been imported yet, this is a no-op — the library is left untouched.
// Merges freshly-scanned shortcuts with what's already known, so favorite/
// recent metadata survives a rescan. We never touch the actual
// .lnk/.url/.gfnpc files themselves — only read them.
ipcMain.handle('library:rescan', async () => {
  const folder = store.get('scanFolder', null);
  const existing = store.get('games', []);
  if (!folder) return existing;

  const found = scanSpecificFolder(folder);
  const ignored = new Set(store.get('ignoredPaths', []));
  const existingByPath = new Map(existing.map((g) => [g.path, g]));

  const merged = found
    .filter((f) => !ignored.has(f.path))
    .map((f) => {
      const prev = existingByPath.get(f.path);
      return prev
        ? { ...f, favorite: prev.favorite, favoritedAt: prev.favoritedAt, lastPlayed: prev.lastPlayed, source: prev.source, image: prev.image, tags: prev.tags }
        : { ...f, favorite: false, favoritedAt: null, lastPlayed: null, source: 'manual', tags: [] };
    });

  // Keep every other game as-is (manually-added shortcuts, anything from
  // outside the imported folder) — a rescan only ever refreshes the one
  // folder it's tracking.
  const foundPaths = new Set(found.map((f) => f.path));
  const keepOthers = existing.filter((g) => !foundPaths.has(g.path));

  const all = [...merged, ...keepOthers];
  store.set('games', all);
  return all;
});

ipcMain.handle('library:get', () => {
  return store.get('games', []);
});

ipcMain.handle('library:addManual', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Add a GeForce NOW shortcut',
    properties: ['openFile'],
    filters: [{ name: 'Shortcuts', extensions: ['lnk', 'url', 'gfnpc'] }],
  });
  if (result.canceled || result.filePaths.length === 0) return store.get('games', []);

  const filePath = result.filePaths[0];
  const name = path.basename(filePath).replace(/\.(lnk|url|gfnpc)$/i, '');
  const games = store.get('games', []);

  if (games.some((g) => g.path === filePath)) return games; // already added

  const game = {
    id: filePath,
    name,
    path: filePath,
    ext: path.extname(filePath).toLowerCase(),
    favorite: false,
    favoritedAt: null,
    lastPlayed: null,
    source: 'manual',
    tags: [],
  };
  const updated = [...games, game];
  store.set('games', updated);
  store.set('ignoredPaths', store.get('ignoredPaths', []).filter((p) => p !== filePath));
  return updated;
});

ipcMain.handle('library:addFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose a folder of GeForce NOW shortcuts',
    properties: ['openDirectory'],
  });
  if (result.canceled || result.filePaths.length === 0) return store.get('games', []);

  const folder = result.filePaths[0];
  const found = scanSpecificFolder(folder);
  const games = store.get('games', []);
  const existingPaths = new Set(games.map((g) => g.path));

  const additions = found
    .filter((f) => !existingPaths.has(f.path))
    .map((f) => ({ ...f, favorite: false, favoritedAt: null, lastPlayed: null, source: 'manual', tags: [] }));

  const updated = [...games, ...additions];
  store.set('games', updated);
  const addedPaths = new Set(additions.map((a) => a.path));
  store.set('ignoredPaths', store.get('ignoredPaths', []).filter((p) => !addedPaths.has(p)));

  // Remember this as the folder future "Rescan" calls should re-check.
  store.set('scanFolder', folder);
  return updated;
});

ipcMain.handle('library:setImage', async (_e, id) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose artwork for this game',
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
  });
  if (result.canceled || result.filePaths.length === 0) return store.get('games', []);

  const imgPath = result.filePaths[0];
  const ext = path.extname(imgPath).toLowerCase();
  const mime = IMAGE_MIME[ext] || 'image/png';
  const dataUrl = `data:${mime};base64,${fs.readFileSync(imgPath).toString('base64')}`;

  const games = store.get('games', []).map((g) => (g.id === id ? { ...g, image: dataUrl } : g));
  store.set('games', games);
  return games;
});

ipcMain.handle('library:remove', (_e, id) => {
  const games = store.get('games', []);
  const target = games.find((g) => g.id === id);
  const remaining = games.filter((g) => g.id !== id);
  store.set('games', remaining);

  if (target) {
    const ignored = store.get('ignoredPaths', []);
    if (!ignored.includes(target.path)) {
      store.set('ignoredPaths', [...ignored, target.path]);
    }
  }
  return remaining;
});

ipcMain.handle('library:toggleFavorite', (_e, id) => {
  const games = store.get('games', []).map((g) => {
    if (g.id !== id) return g;
    const favorite = !g.favorite;
    // Stamp when it was favorited so the UI can pin favorites to the front
    // in the order they were favorited, most-recent last-favorited kept
    // consistent even if toggled off and back on later.
    return { ...g, favorite, favoritedAt: favorite ? Date.now() : null };
  });
  store.set('games', games);
  return games;
});

ipcMain.handle('library:launch', async (_e, id) => {
  const games = store.get('games', []);
  const game = games.find((g) => g.id === id);
  if (!game) return { ok: false, error: 'Game not found', games };

  // We only ever hand the existing shortcut file to the OS to open, exactly
  // as double-clicking it would. We never modify GeForce NOW or its files.
  const errorMessage = await shell.openPath(game.path);
  if (errorMessage) {
    return { ok: false, error: errorMessage, games };
  }

  const updated = games.map((g) =>
    g.id === id ? { ...g, lastPlayed: new Date().toISOString() } : g
  );
  store.set('games', updated);
  return { ok: true, games: updated };
});

ipcMain.handle('library:setTags', (_e, id, tags) => {
  const clean = Array.from(
    new Set((tags || []).map((t) => t.trim()).filter(Boolean))
  );
  const games = store.get('games', []).map((g) =>
    g.id === id ? { ...g, tags: clean } : g
  );
  store.set('games', games);
  return games;
});

// ---- IPC: settings -------------------------------------------------------

ipcMain.handle('settings:getApiKey', () => store.get('steamGridDbApiKey', ''));

ipcMain.handle('settings:setApiKey', (_e, key) => {
  store.set('steamGridDbApiKey', (key || '').trim());
  return store.get('steamGridDbApiKey', '');
});

ipcMain.handle('settings:getAutoLaunch', () => store.get('autoLaunch', false));

ipcMain.handle('settings:setAutoLaunch', (_e, enabled) => {
  store.set('autoLaunch', !!enabled);
  applyAutoLaunch(!!enabled);
  return store.get('autoLaunch', false);
});

// ---- IPC: window -----------------------------------------------------

// Lets the renderer request real OS-level fullscreen — used to jump into
// Big Picture mode automatically the moment a controller is detected.
ipcMain.handle('window:setFullscreen', (_e, enabled) => {
  if (!mainWindow) return false;
  mainWindow.setFullScreen(!!enabled);
  return mainWindow.isFullScreen();
});

// ---- IPC: automatic artwork (SteamGridDB) --------------------------------

ipcMain.handle('library:fetchArtwork', async (_e, id) => {
  const apiKey = store.get('steamGridDbApiKey', '');
  const games = store.get('games', []);
  if (!apiKey) return { ok: false, error: 'Add a SteamGridDB API key in Settings first.', games };

  const game = games.find((g) => g.id === id);
  if (!game) return { ok: false, error: 'Game not found', games };

  try {
    const image = await fetchArtworkForName(game.name, apiKey);
    if (!image) return { ok: false, error: `No artwork found for "${game.name}".`, games };
    const updated = games.map((g) => (g.id === id ? { ...g, image } : g));
    store.set('games', updated);
    return { ok: true, games: updated };
  } catch (err) {
    return { ok: false, error: err.message, games };
  }
});

// Fills in artwork for every game that doesn't already have an image
// (manually-set images are never overwritten). Goes one at a time and keeps
// whatever it found even if a later game fails, so a rate limit or a typo'd
// name partway through doesn't lose earlier progress.
ipcMain.handle('library:fetchAllArtwork', async () => {
  const apiKey = store.get('steamGridDbApiKey', '');
  let games = store.get('games', []);
  if (!apiKey) return { ok: false, error: 'Add a SteamGridDB API key in Settings first.', games };

  const misses = [];
  for (const game of games) {
    if (game.image) continue;
    try {
      const image = await fetchArtworkForName(game.name, apiKey);
      if (image) {
        games = games.map((g) => (g.id === game.id ? { ...g, image } : g));
        store.set('games', games);
      } else {
        misses.push(game.name);
      }
    } catch {
      misses.push(game.name);
    }
  }

  return {
    ok: misses.length === 0,
    error: misses.length ? `No artwork found for: ${misses.join(', ')}` : null,
    games,
  };
});
