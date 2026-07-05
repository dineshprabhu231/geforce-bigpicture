import React, { useMemo } from 'react';

// Deterministic gradient per game name, used until real artwork is set.
export function gradientFor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const h1 = Math.abs(hash) % 360;
  const h2 = (h1 + 46) % 360;
  return `linear-gradient(155deg, hsl(${h1} 45% 22%), hsl(${h2} 55% 12%))`;
}

export default function GameTile({ game, focused, fetchingArt, onSelect, onSetImage, onFetchArtwork, onEditTags, onRemove }) {
  const gradient = useMemo(() => gradientFor(game.name), [game.name]);
  const initial = game.name.trim().charAt(0).toUpperCase() || 'G';

  return (
    <div
      className={[
        'group relative flex-shrink-0 w-44 aspect-[3/4] rounded-xl overflow-hidden transition-transform duration-150',
        focused ? 'tile-focused shadow-focus z-10' : 'shadow-md shadow-black/40',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={onSelect}
        tabIndex={-1}
        className="absolute inset-0 focus:outline-none transition-transform duration-200 ease-out group-hover:scale-110"
        style={game.image ? undefined : { background: gradient }}
      >
        {game.image ? (
          <img src={game.image} alt="" className="w-full h-full object-cover" draggable={false} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-display text-6xl font-bold text-white/25">{initial}</span>
          </div>
        )}
      </button>

      {fetchingArt && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 pointer-events-none">
          <span className="text-xs font-body text-ink">Fetching…</span>
        </div>
      )}

      <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onFetchArtwork(); }}
          tabIndex={-1}
          title="Auto-fetch artwork (SteamGridDB)"
          className="w-6 h-6 rounded-full bg-black/60 hover:bg-accent hover:text-black text-ink text-xs flex items-center justify-center"
        >
          🔍
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onSetImage(); }}
          tabIndex={-1}
          title="Set artwork manually"
          className="w-6 h-6 rounded-full bg-black/60 hover:bg-accent hover:text-black text-ink text-xs flex items-center justify-center"
        >
          🖼
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onEditTags(); }}
          tabIndex={-1}
          title="Edit collections/tags"
          className="w-6 h-6 rounded-full bg-black/60 hover:bg-accent hover:text-black text-ink text-xs flex items-center justify-center"
        >
          🏷
        </button>
      </div>

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        tabIndex={-1}
        title="Remove from list"
        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 hover:bg-red-600 text-ink text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100"
      >
        ✕
      </button>

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-3 pt-8 pb-3 pointer-events-none">
        <p className="font-body font-semibold text-ink text-sm leading-tight truncate flex items-center gap-1">
          {game.favorite && <span className="text-accent-soft" aria-hidden>★</span>}
          {game.name}
        </p>
        {game.tags && game.tags.length > 0 && (
          <p className="font-body text-[10px] text-muted truncate mt-0.5">{game.tags.join(' · ')}</p>
        )}
      </div>
    </div>
  );
}
