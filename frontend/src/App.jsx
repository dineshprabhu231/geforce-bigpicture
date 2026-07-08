import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import GameGrid from './components/GameGrid.jsx';
import { gradientFor } from './components/GameTile.jsx';
import RecentRow from './components/RecentRow.jsx';
import TagFilterBar from './components/TagFilterBar.jsx';
import TagEditor from './components/TagEditor.jsx';
import ControlHints from './components/ControlHints.jsx';
import EmptyState from './components/EmptyState.jsx';
import SettingsPanel from './components/SettingsPanel.jsx';
import LaunchOverlay from './components/LaunchOverlay.jsx';
import ConfirmModal from './components/ConfirmModal.jsx';
import { useGamepadNavigation } from './hooks/useGamepadNavigation.js';
import { detectPadType, setRumbleConfig, DEFAULT_CONTROLLER_MAP } from './utils/gamepad.js';
import { applyFont } from './utils/fonts.js';
import {
  playLaunchSound,
  playFavoriteSound,
  playControllerConnectSound,
  playControllerDisconnectSound,
} from './utils/sfx.js';

const RECENT_COUNT = 8;
const TOAST_DURATION_MS = 2500;

// Favorites pinned to the front, in the order they were favorited (oldest
// favorite first). Everything else keeps its existing relative order.
function sortGames(list) {
  const favorites = list
    .filter((g) => g.favorite)
    .sort((a, b) => (a.favoritedAt || 0) - (b.favoritedAt || 0));
  const rest = list.filter((g) => !g.favorite);
  return [...favorites, ...rest];
}

export default function App() {
  const [games, setGames] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [launchError, setLaunchError] = useState(null);
  const [launchingGame, setLaunchingGame] = useState(null); // { name } while GFN is starting up
  const [autoLaunch, setAutoLaunch] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  // Appearance/controller/vibration preferences — loaded from disk on
  // mount, applied immediately, and re-saved whenever Settings changes them.
  const [prefs, setPrefsState] = useState({
    font: 'default',
    controllerMap: DEFAULT_CONTROLLER_MAP,
    vibration: { enabled: true, weakMagnitude: 1, strongMagnitude: 1 },
  });
  const [fetchingArtId, setFetchingArtId] = useState(null);
  const [fetchingAll, setFetchingAll] = useState(false);
  const [artworkNotice, setArtworkNotice] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState(null);
  const [tagEditorIndex, setTagEditorIndex] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(null); // { id, name } while the remove dialog is open
  const [hoveredId, setHoveredId] = useState(null);
  const [gamepadToast, setGamepadToast] = useState(null); // { kind: 'connected'|'disconnected', label }
  const [cursorVisible, setCursorVisible] = useState(true);
  const rowRef = useRef(null);
  const searchInputRef = useRef(null);
  const toastTimerRef = useRef(null);
  // Tracks which game is focused so that re-sorting the row (e.g. after a
  // favorite toggle moves a tile to the front) doesn't leave the highlight
  // sitting on the wrong game.
  const focusedGameIdRef = useRef(null);

  const bridge = window.gfnLauncher;

  // Sorts an updated game list, applies it, and keeps the same game focused
  // (or a specific one, via preferredId) even though its index may have
  // changed as a result of sorting.
  const applyGames = useCallback((list, preferredId) => {
    const sorted = sortGames(list);
    setGames(sorted);
    const keepId = preferredId !== undefined ? preferredId : focusedGameIdRef.current;
    const idx = keepId ? sorted.findIndex((g) => g.id === keepId) : -1;
    if (idx !== -1) {
      setGridIndex(idx);
    } else {
      setGridIndex((i) => Math.min(i, Math.max(sorted.length - 1, 0)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadLibrary = useCallback(async () => {
    const lib = await bridge.getLibrary();
    applyGames(lib);
  }, [bridge, applyGames]);

  const rescan = useCallback(async () => {
    setScanning(true);
    try {
      const lib = await bridge.rescan();
      applyGames(lib);
    } finally {
      setScanning(false);
    }
  }, [bridge, applyGames]);

  useEffect(() => {
    // No more auto-scan on launch — just load whatever's already in the
    // library. "Rescan" only re-checks a folder once one's been imported.
    loadLibrary();
    bridge.getAutoLaunch().then(setAutoLaunch);
    bridge.getPrefs?.().then((saved) => {
      if (!saved) return;
      setPrefsState(saved);
      applyFont(saved.font);
      setRumbleConfig({
        enabled: saved.vibration?.enabled ?? true,
        weak: saved.vibration?.weakMagnitude ?? 1,
        strong: saved.vibration?.strongMagnitude ?? 1,
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persists a partial preferences update (merged with what's already
  // saved) and immediately applies its visible/tactile effects — called
  // from the Settings panel any time a font, mapping, or vibration control
  // changes, so there's no separate "Save" step.
  const updatePrefs = useCallback(
    async (partial) => {
      const next = { ...prefs, ...partial };
      setPrefsState(next);
      if (partial.font) applyFont(partial.font);
      if (partial.vibration) {
        setRumbleConfig({
          enabled: next.vibration.enabled,
          weak: next.vibration.weakMagnitude,
          strong: next.vibration.strongMagnitude,
        });
      }
      const saved = await bridge.setPrefs?.(next);
      if (saved) setPrefsState(saved);
    },
    [prefs, bridge]
  );

  useEffect(() => () => clearTimeout(toastTimerRef.current), []);

  // Search + collection filtering happen on top of the sorted (favorites
  // pinned) list. Search matches by name only; the tag filter is exclusive
  // (one collection at a time, or "All").
  const visibleGames = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return games.filter((g) => {
      if (query && !g.name.toLowerCase().includes(query)) return false;
      if (activeTag && !(g.tags || []).includes(activeTag)) return false;
      return true;
    });
  }, [games, searchQuery, activeTag]);

  // Every distinct tag across the whole library, for the filter chips and
  // the tag editor's "existing tags" suggestions.
  const allTags = useMemo(() => {
    const set = new Set();
    games.forEach((g) => (g.tags || []).forEach((t) => set.add(t)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [games]);

  // "Continue playing" — most-recently-launched games, independent of the
  // favorites pin. Hidden while searching/filtering to keep the screen
  // focused on the result set the person actually asked for.
  const recentGames = useMemo(() => {
    if (searchQuery.trim() || activeTag) return [];
    return games
      .filter((g) => g.lastPlayed)
      .sort((a, b) => new Date(b.lastPlayed) - new Date(a.lastPlayed))
      .slice(0, RECENT_COUNT);
  }, [games, searchQuery, activeTag]);

  const launchGame = useCallback(
    async (index) => {
      const game = visibleGames[index];
      if (!game) return;
      setLaunchError(null);
      setLaunchingGame({ name: game.name });
      playLaunchSound();
      const result = await bridge.launch(game.id);
      if (result.games) applyGames(result.games, game.id);
      if (!result.ok) {
        setLaunchError(`Couldn't launch ${game.name}: ${result.error}`);
        setLaunchingGame(null);
      }
    },
    [visibleGames, bridge, applyGames]
  );

  const launchGameById = useCallback(
    async (id) => {
      const game = games.find((g) => g.id === id);
      if (!game) return;
      setLaunchError(null);
      setLaunchingGame({ name: game.name });
      playLaunchSound();
      const result = await bridge.launch(id);
      if (result.games) applyGames(result.games, id);
      if (!result.ok) {
        setLaunchError(`Couldn't launch ${game.name}: ${result.error}`);
        setLaunchingGame(null);
      }
    },
    [games, bridge, applyGames]
  );

  const toggleFavorite = useCallback(
    async (index) => {
      const game = visibleGames[index];
      if (!game) return;
      const updated = await bridge.toggleFavorite(game.id);
      const nowFavorite = updated.find((g) => g.id === game.id)?.favorite;
      playFavoriteSound(!!nowFavorite);
      applyGames(updated, game.id);
    },
    [visibleGames, bridge, applyGames]
  );

  const setImage = useCallback(
    async (index) => {
      const game = visibleGames[index];
      if (!game) return;
      const updated = await bridge.setImage(game.id);
      applyGames(updated, game.id);
    },
    [visibleGames, bridge, applyGames]
  );

  const fetchArtwork = useCallback(
    async (index) => {
      const game = visibleGames[index];
      if (!game) return;
      setArtworkNotice(null);
      setFetchingArtId(game.id);
      try {
        const result = await bridge.fetchArtwork(game.id);
        applyGames(result.games, game.id);
        if (!result.ok) setArtworkNotice(result.error);
      } finally {
        setFetchingArtId(null);
      }
    },
    [visibleGames, bridge, applyGames]
  );

  const fetchAllArtwork = useCallback(async () => {
    setArtworkNotice(null);
    setFetchingAll(true);
    try {
      const result = await bridge.fetchAllArtwork();
      applyGames(result.games);
      if (!result.ok) setArtworkNotice(result.error);
    } finally {
      setFetchingAll(false);
    }
  }, [bridge, applyGames]);

  const toggleAutoLaunch = useCallback(
    async (enabled) => {
      const saved = await bridge.setAutoLaunch(enabled);
      setAutoLaunch(saved);
    },
    [bridge]
  );

  // Remove now goes through a controller-friendly confirm modal instead of
  // window.confirm (which a gamepad can't interact with at all). Requesting
  // remembers the game's id/name rather than its index, so the confirmation
  // still targets the right game even if the visible list re-sorts or
  // re-filters in the moment between asking and confirming.
  const requestRemove = useCallback(
    (index) => {
      const game = visibleGames[index];
      if (!game) return;
      setConfirmRemove({ id: game.id, name: game.name });
    },
    [visibleGames]
  );

  const confirmRemoveGame = useCallback(async () => {
    if (!confirmRemove) return;
    const { id } = confirmRemove;
    setConfirmRemove(null);
    const updated = await bridge.remove(id);
    applyGames(updated);
  }, [confirmRemove, bridge, applyGames]);

  const cancelRemove = useCallback(() => setConfirmRemove(null), []);

  const saveTags = useCallback(
    async (tags) => {
      const game = visibleGames[tagEditorIndex];
      if (!game) { setTagEditorIndex(null); return; }
      const updated = await bridge.setTags(game.id, tags);
      applyGames(updated, game.id);
      setTagEditorIndex(null);
    },
    [visibleGames, tagEditorIndex, bridge, applyGames]
  );

  const addManual = useCallback(async () => {
    const updated = await bridge.addManual();
    applyGames(updated);
  }, [bridge, applyGames]);

  const addFolder = useCallback(async () => {
    setScanning(true);
    try {
      const updated = await bridge.addFolder();
      applyGames(updated);
    } finally {
      setScanning(false);
    }
  }, [bridge, applyGames]);

  const missingArtCount = games.filter((g) => !g.image).length;
  const showSearch = games.length > 8;

  // Header controls are built up in the same order they're rendered below,
  // so their index in this list is exactly their index in the "header"
  // navigation zone — no separate bookkeeping needed.
  let hIdx = 0;
  const searchHIdx = showSearch ? hIdx++ : -1;
  const rescanHIdx = hIdx++;
  const importHIdx = hIdx++;
  const addShortcutHIdx = hIdx++;
  const fetchArtHIdx = missingArtCount > 0 ? hIdx++ : -1;
  const settingsHIdx = hIdx++;
  const headerCount = hIdx;

  const onHeaderActivate = useCallback(
    (i) => {
      if (i === searchHIdx) { searchInputRef.current?.focus(); return; }
      if (i === rescanHIdx) { rescan(); return; }
      if (i === importHIdx) { addFolder(); return; }
      if (i === addShortcutHIdx) { addManual(); return; }
      if (i === fetchArtHIdx) { fetchAllArtwork(); return; }
      if (i === settingsHIdx) { setShowSettings(true); return; }
    },
    [searchHIdx, rescanHIdx, importHIdx, addShortcutHIdx, fetchArtHIdx, settingsHIdx, rescan, addFolder, addManual, fetchAllArtwork]
  );

  const onFilterActivate = useCallback(
    (i) => setActiveTag(i === 0 ? null : allTags[i - 1]),
    [allTags]
  );

  const quitApp = useCallback(() => {
    window.gfnLauncher?.closeApp?.();
  }, []);

  const handleControllerInput = useCallback(() => {
    setCursorVisible(false);
  }, []);

  const handleGamepadConnect = useCallback((pad) => {
    playControllerConnectSound();
    const label = detectPadType(pad?.id) === 'playstation' ? 'PlayStation controller connected' : 'Controller connected';
    setGamepadToast({ kind: 'connected', label });
    setCursorVisible(false);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setGamepadToast(null), TOAST_DURATION_MS);
  }, []);

  const handleGamepadDisconnect = useCallback(() => {
    playControllerDisconnectSound();
    setGamepadToast({ kind: 'disconnected', label: 'Controller disconnected' });
    setCursorVisible(true);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setGamepadToast(null), TOAST_DURATION_MS);
  }, []);

  // Any open modal owns input by itself (via useModalNav), so the main
  // header/filters/grid navigation pauses entirely while one is up.
  const anyModalOpen = showSettings || tagEditorIndex !== null || confirmRemove !== null;

  const {
    zone,
    setZone,
    gridIndex,
    setGridIndex,
    recentIndex,
    setRecentIndex,
    headerIndex,
    filterIndex,
    focusHover,
    inputMethod,
    setInputMethod,
    gamepadConnected,
  } = useGamepadNavigation({
    gridCount: visibleGames.length,
    headerCount,
    filterCount: allTags.length > 0 ? allTags.length + 1 : 0,
    recentCount: recentGames.length,
    disabled: anyModalOpen,
    onGridActivate: launchGame,
    onGridSecondary: toggleFavorite,
    onGridTertiary: setImage,
    onGridRemove: requestRemove,
    onRecentActivate: (index) => {
      const recentGame = recentGames[index];
      if (!recentGame) return;
      const gridIdx = visibleGames.findIndex((game) => game.id === recentGame.id);
      if (gridIdx !== -1) {
        setGridIndex(gridIdx);
        setZone('grid');
      }
    },
    onHeaderActivate,
    onFilterActivate,
    onControllerInput: handleControllerInput,
    onGamepadConnect: handleGamepadConnect,
    onGamepadDisconnect: handleGamepadDisconnect,
    buttonMap: prefs.controllerMap,
  });

  // Keep the ref in sync so applyGames always knows which game was focused,
  // without needing gridIndex/games in its own dependency list.
  useEffect(() => {
    focusedGameIdRef.current = visibleGames[gridIndex]?.id ?? null;
  });

  // `hoveredId` exists purely to preview a game's art while the mouse sits
  // over a *different* tile than the current focus (e.g. hovering the
  // Continue Playing row without committing to it). The moment the actual
  // grid focus moves — via keyboard, gamepad, a click, or selecting from
  // Continue Playing — that preview is stale and should stop overriding the
  // banner, which is why this drops it back to null on every focus change.
  useEffect(() => {
    setHoveredId(null);
  }, [gridIndex]);

  // Keep the focused tile scrolled into view, horizontally centered
  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const tile = row.children[gridIndex];
    if (tile) tile.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [gridIndex]);

  useEffect(() => {
    const onMouseActivity = () => {
      setInputMethod('keyboard');
      setCursorVisible(true);
    };
    window.addEventListener('mousemove', onMouseActivity);
    window.addEventListener('mousedown', onMouseActivity);
    return () => {
      window.removeEventListener('mousemove', onMouseActivity);
      window.removeEventListener('mousedown', onMouseActivity);
    };
  }, [setInputMethod]);

  useEffect(() => {
    document.body.classList.toggle('hide-cursor', !cursorVisible);
    return () => document.body.classList.remove('hide-cursor');
  }, [cursorVisible]);

  const focusedGame = visibleGames[gridIndex];
  const bannerGame = (hoveredId && games.find((g) => g.id === hoveredId)) || focusedGame;

  const headerBtnClass = (focused) =>
    [
      'text-sm font-body px-4 py-2 rounded-lg bg-panel-raised border transition-colors disabled:opacity-50 flex-shrink-0',
      focused ? 'border-accent ring-2 ring-ink ring-offset-2 ring-offset-void' : 'border-white/10 hover:border-accent',
    ].join(' ');

  return (
    <div className="h-screen bg-void text-ink font-body overflow-hidden relative">
      {/* Ambient banner — artwork of whichever game is hovered (or
          gamepad-focused), with its title overlaid, so the top of the
          screen doesn't feel so bare. */}
      <div className="absolute inset-x-0 top-0 h-80 overflow-hidden pointer-events-none">
        {bannerGame && (
          bannerGame.image ? (
            <img
              key={bannerGame.id}
              src={bannerGame.image}
              alt=""
              className="w-full h-full object-cover scale-105 opacity-60"
            />
          ) : (
            <div
              key={bannerGame.id}
              className="w-full h-full opacity-70"
              style={{ background: gradientFor(bannerGame.name) }}
            />
          )
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-void/10 via-void/60 to-void" />
        <div className="absolute inset-0 bg-gradient-to-r from-void/80 via-void/10 to-void/80" />
      </div>

      {gamepadToast && (
        <div className="fixed top-6 right-6 z-50 toast-in px-4 py-2.5 rounded-lg bg-panel-raised border border-white/10 shadow-xl text-sm font-body flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" className={['w-4 h-4 flex-shrink-0', gamepadToast.kind === 'connected' ? 'text-accent' : 'text-muted'].join(' ')} aria-hidden>
            {gamepadToast.kind === 'connected' ? (
              <path
                d="M7 8h3M8.5 6.5v3M14.5 9.5h.01M17 7.5h.01M5.5 8c-1.4 0-2.6 1-2.9 2.4l-1 4.6c-.3 1.4.8 2.7 2.2 2.7.6 0 1.2-.3 1.6-.7l1.6-1.8c.4-.5 1-.7 1.6-.7h6.8c.6 0 1.2.2 1.6.7l1.6 1.8c.4.5 1 .7 1.6.7 1.4 0 2.5-1.3 2.2-2.7l-1-4.6C20.1 9 18.9 8 17.5 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : (
              <path
                d="M12 9v4m0 3h.01M10.3 4.4 2.7 17.5c-.6 1 .1 2.3 1.3 2.3h16c1.2 0 1.9-1.3 1.3-2.3L13.7 4.4c-.6-1-2-1-2.6 0Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </svg>
          <span className={gamepadToast.kind === 'connected' ? 'text-ink' : 'text-muted'}>{gamepadToast.label}</span>
        </div>
      )}

      <div className="relative z-10 h-full flex flex-col">
      <header className="flex items-center justify-between px-10 py-6 flex-shrink-0 gap-4">
        <h1 className="font-display text-2xl font-bold tracking-wide flex-shrink-0">
          Big Picture <span className="text-accent">for GeForce NOW</span>
        </h1>
        <div className="flex items-center gap-3 min-w-0">
          {showSearch && (
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search games…"
              className={[
                'w-48 text-sm font-body px-3 py-2 rounded-lg bg-panel-raised border text-ink placeholder:text-muted focus:outline-none focus:border-accent transition-colors',
                zone === 'header' && headerIndex === searchHIdx ? 'border-accent ring-2 ring-ink ring-offset-2 ring-offset-void' : 'border-white/10',
              ].join(' ')}
            />
          )}
          <button
            onClick={rescan}
            disabled={scanning}
            className={headerBtnClass(zone === 'header' && headerIndex === rescanHIdx)}
          >
            {scanning ? 'Scanning…' : 'Rescan'}
          </button>
          <button
            onClick={addFolder}
            disabled={scanning}
            className={headerBtnClass(zone === 'header' && headerIndex === importHIdx)}
          >
            + Import folder
          </button>
          <button
            onClick={addManual}
            className={headerBtnClass(zone === 'header' && headerIndex === addShortcutHIdx)}
          >
            + Add shortcut
          </button>
          {missingArtCount > 0 && (
            <button
              onClick={fetchAllArtwork}
              disabled={fetchingAll}
              className={headerBtnClass(zone === 'header' && headerIndex === fetchArtHIdx)}
            >
              {fetchingAll ? 'Fetching artwork…' : `Fetch artwork (${missingArtCount})`}
            </button>
          )}
          <button
            onClick={() => setShowSettings(true)}
            title="Settings"
            className={[
              'text-sm font-body w-9 h-9 flex items-center justify-center rounded-lg bg-panel-raised border transition-colors flex-shrink-0',
              zone === 'header' && headerIndex === settingsHIdx ? 'border-accent ring-2 ring-ink ring-offset-2 ring-offset-void' : 'border-white/10 hover:border-accent',
            ].join(' ')}
          >
            ⚙
          </button>
        </div>
      </header>

      <div className="px-10 pb-4 -mt-1 flex-shrink-0 h-9 flex items-end">
        {bannerGame && (
          <p className="font-display text-2xl font-bold text-ink drop-shadow-lg truncate">
            {bannerGame.name}
          </p>
        )}
      </div>

      {launchError && (
        <div className="mx-10 mb-4 px-4 py-3 rounded-lg bg-red-950/60 border border-red-800 text-red-200 text-sm flex-shrink-0">
          {launchError}
        </div>
      )}

      {artworkNotice && (
        <div className="mx-10 mb-4 px-4 py-3 rounded-lg bg-panel-raised border border-white/10 text-muted text-sm flex-shrink-0">
          {artworkNotice}
        </div>
      )}

      <TagFilterBar
        tags={allTags}
        activeTag={activeTag}
        onSelect={setActiveTag}
        zoneActive={zone === 'filters'}
        focusedIndex={filterIndex}
      />

      {games.length === 0 ? (
        <EmptyState onAddFolder={addFolder} onAddManual={addManual} scanning={scanning} />
      ) : (
        <>
          <RecentRow
            games={recentGames}
            focusedIndex={recentIndex}
            zoneActive={zone === 'recent'}
            onSelect={(id) => {
              const index = visibleGames.findIndex((game) => game.id === id);
              if (index !== -1) {
                setGridIndex(index);
                setZone('grid');
              }
            }}
            onHover={setHoveredId}
            onFocusHover={(gameId) => {
              setHoveredId(gameId);
              const idx = recentGames.findIndex((game) => game.id === gameId);
              if (idx !== -1) setRecentIndex(idx);
            }}
          />
          {visibleGames.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-muted font-body">
              No games match "{searchQuery || activeTag}".
            </div>
          ) : (
            <GameGrid
              games={visibleGames}
              focusedIndex={gridIndex}
              fetchingArtId={fetchingArtId}
              onSelect={(i) => {
                setGridIndex(i);
                launchGame(i);
              }}
              onSetImage={setImage}
              onFetchArtwork={fetchArtwork}
              onEditTags={setTagEditorIndex}
              onRemove={requestRemove}
              onHover={setHoveredId}
              onFocusHover={focusHover}
              rowRef={rowRef}
            />
          )}
        </>
      )}

      <ControlHints
        inputMethod={inputMethod}
        zone={zone}
        gamepadConnected={gamepadConnected}
        buttonMap={prefs.controllerMap}
      />

      {showSettings && (
        <SettingsPanel
          autoLaunch={autoLaunch}
          onToggleAutoLaunch={toggleAutoLaunch}
          onClose={() => setShowSettings(false)}
          onQuit={quitApp}
          onControllerInput={handleControllerInput}
          prefs={prefs}
          onUpdatePrefs={updatePrefs}
          inputMethod={inputMethod}
        />
      )}

      {launchingGame && (
        <LaunchOverlay
          gameName={launchingGame.name}
          onDismiss={() => setLaunchingGame(null)}
        />
      )}

      {tagEditorIndex !== null && visibleGames[tagEditorIndex] && (
        <TagEditor
          game={visibleGames[tagEditorIndex]}
          allTags={allTags}
          onSave={saveTags}
          onClose={() => setTagEditorIndex(null)}
          onControllerInput={handleControllerInput}
        />
      )}

      {confirmRemove && (
        <ConfirmModal
          title="Remove game?"
          message={`Remove "${confirmRemove.name}" from this list? The shortcut file itself is untouched — you can re-import it later.`}
          confirmLabel="Remove"
          cancelLabel="Cancel"
          destructive
          onConfirm={confirmRemoveGame}
          onCancel={cancelRemove}
          onControllerInput={handleControllerInput}
        />
      )}
      </div>
    </div>
  );
}
