import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import GameGrid from './components/GameGrid.jsx';
import { gradientFor } from './components/GameTile.jsx';
import RecentRow from './components/RecentRow.jsx';
import TagFilterBar from './components/TagFilterBar.jsx';
import TagEditor from './components/TagEditor.jsx';
import ControlHints from './components/ControlHints.jsx';
import EmptyState from './components/EmptyState.jsx';
import SettingsPanel from './components/SettingsPanel.jsx';
import { useGamepadNavigation } from './hooks/useGamepadNavigation.js';
import { playLaunchSound, playFavoriteSound } from './utils/sfx.js';

const RECENT_COUNT = 8;

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
  const [autoLaunch, setAutoLaunch] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [fetchingArtId, setFetchingArtId] = useState(null);
  const [fetchingAll, setFetchingAll] = useState(false);
  const [artworkNotice, setArtworkNotice] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState(null);
  const [tagEditorIndex, setTagEditorIndex] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const rowRef = useRef(null);
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
      setFocusedIndex(idx);
    } else {
      setFocusedIndex((i) => Math.min(i, Math.max(sorted.length - 1, 0)));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      playLaunchSound();
      const result = await bridge.launch(game.id);
      if (result.games) applyGames(result.games, game.id);
      if (!result.ok) setLaunchError(`Couldn't launch ${game.name}: ${result.error}`);
    },
    [visibleGames, bridge, applyGames]
  );

  const launchGameById = useCallback(
    async (id) => {
      const game = games.find((g) => g.id === id);
      if (!game) return;
      setLaunchError(null);
      playLaunchSound();
      const result = await bridge.launch(id);
      if (result.games) applyGames(result.games, id);
      if (!result.ok) setLaunchError(`Couldn't launch ${game.name}: ${result.error}`);
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

  const removeGame = useCallback(
    async (index) => {
      const game = visibleGames[index];
      if (!game) return;
      const confirmed = window.confirm(
        `Remove "${game.name}" from this list? (Only removes it here — the shortcut file itself is untouched.)`
      );
      if (!confirmed) return;
      const updated = await bridge.remove(game.id);
      applyGames(updated);
    },
    [visibleGames, bridge, applyGames]
  );

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

  const { focusedIndex, setFocusedIndex, focusHover, inputMethod } = useGamepadNavigation(
    visibleGames.length,
    launchGame,
    toggleFavorite,
    setImage
  );

  // Keep the ref in sync so applyGames always knows which game was focused,
  // without needing focusedIndex/games in its own dependency list.
  useEffect(() => {
    focusedGameIdRef.current = visibleGames[focusedIndex]?.id ?? null;
  });

  // Keep the focused tile scrolled into view, horizontally centered
  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const tile = row.children[focusedIndex];
    if (tile) tile.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [focusedIndex]);

  const focusedGame = visibleGames[focusedIndex];
  const bannerGame = (hoveredId && games.find((g) => g.id === hoveredId)) || focusedGame;
  const missingArtCount = games.filter((g) => !g.image).length;
  const showSearch = games.length > 8;

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

      <div className="relative z-10 h-full flex flex-col">
      <header className="flex items-center justify-between px-10 py-6 flex-shrink-0 gap-4">
        <h1 className="font-display text-2xl font-bold tracking-wide flex-shrink-0">
          Big Picture <span className="text-accent">for GeForce NOW</span>
        </h1>
        <div className="flex items-center gap-3 min-w-0">
          {showSearch && (
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search games…"
              className="w-48 text-sm font-body px-3 py-2 rounded-lg bg-panel-raised border border-white/10 text-ink placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
            />
          )}
          <button
            onClick={rescan}
            disabled={scanning}
            className="text-sm font-body px-4 py-2 rounded-lg bg-panel-raised border border-white/10 hover:border-accent transition-colors disabled:opacity-50 flex-shrink-0"
          >
            {scanning ? 'Scanning…' : 'Rescan'}
          </button>
          <button
            onClick={addFolder}
            disabled={scanning}
            className="text-sm font-body px-4 py-2 rounded-lg bg-panel-raised border border-white/10 hover:border-accent transition-colors disabled:opacity-50 flex-shrink-0"
          >
            + Import folder
          </button>
          <button
            onClick={addManual}
            className="text-sm font-body px-4 py-2 rounded-lg bg-panel-raised border border-white/10 hover:border-accent transition-colors flex-shrink-0"
          >
            + Add shortcut
          </button>
          {missingArtCount > 0 && (
            <button
              onClick={fetchAllArtwork}
              disabled={fetchingAll}
              className="text-sm font-body px-4 py-2 rounded-lg bg-panel-raised border border-white/10 hover:border-accent transition-colors disabled:opacity-50 flex-shrink-0"
            >
              {fetchingAll ? 'Fetching artwork…' : `Fetch artwork (${missingArtCount})`}
            </button>
          )}
          <button
            onClick={() => setShowSettings(true)}
            title="Settings"
            className="text-sm font-body w-9 h-9 flex items-center justify-center rounded-lg bg-panel-raised border border-white/10 hover:border-accent transition-colors flex-shrink-0"
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

      <TagFilterBar tags={allTags} activeTag={activeTag} onSelect={setActiveTag} />

      {games.length === 0 ? (
        <EmptyState onAddFolder={addFolder} onAddManual={addManual} scanning={scanning} />
      ) : (
        <>
          <RecentRow games={recentGames} onLaunch={launchGameById} onHover={setHoveredId} />
          {visibleGames.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-muted font-body">
              No games match "{searchQuery || activeTag}".
            </div>
          ) : (
            <GameGrid
              games={visibleGames}
              focusedIndex={focusedIndex}
              fetchingArtId={fetchingArtId}
              onSelect={(i) => {
                setFocusedIndex(i);
                launchGame(i);
              }}
              onSetImage={setImage}
              onFetchArtwork={fetchArtwork}
              onEditTags={setTagEditorIndex}
              onRemove={removeGame}
              onHover={setHoveredId}
              onFocusHover={focusHover}
              rowRef={rowRef}
            />
          )}
        </>
      )}

      <ControlHints inputMethod={inputMethod} gameName={focusedGame?.name} />

      {showSettings && (
        <SettingsPanel
          autoLaunch={autoLaunch}
          onToggleAutoLaunch={toggleAutoLaunch}
          onClose={() => setShowSettings(false)}
        />
      )}

      {tagEditorIndex !== null && visibleGames[tagEditorIndex] && (
        <TagEditor
          game={visibleGames[tagEditorIndex]}
          allTags={allTags}
          onSave={saveTags}
          onClose={() => setTagEditorIndex(null)}
        />
      )}
      </div>
    </div>
  );
}
