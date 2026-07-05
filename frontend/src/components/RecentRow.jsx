import React from 'react';

// Small strip of the most-recently-launched games, separate from favorites.
// Selecting a tile jumps the main shelf to the matching game below.
export default function RecentRow({ games, focusedIndex = 0, zoneActive = false, onSelect, onHover, onFocusHover }) {
  if (games.length === 0) return null;

  return (
    <div className="px-10 pt-2 pb-1 flex-shrink-0">
      <h2 className="font-body text-xs font-semibold tracking-wide text-muted uppercase mb-2">
        Continue playing
      </h2>
      <div className="flex gap-3 overflow-x-auto">
        {games.map((game, index) => (
          <button
            key={game.id}
            type="button"
            onClick={() => onSelect && onSelect(game.id)}
            onMouseEnter={() => onHover && onHover(game.id)}
            onMouseLeave={() => onHover && onHover(null)}
            onFocus={() => onFocusHover && onFocusHover(game.id)}
            onBlur={() => onHover && onHover(null)}
            className={[
              'group relative flex-shrink-0 w-24 aspect-[3/4] rounded-lg overflow-hidden border transition-colors outline-none',
              zoneActive && focusedIndex === index
                ? 'border-accent ring-2 ring-ink ring-offset-2 ring-offset-void'
                : 'border-white/10 hover:border-accent focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-void',
            ].join(' ')}
            title={game.name}
          >
            {game.image ? (
              <img src={game.image} alt="" className="w-full h-full object-cover" draggable={false} />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-panel-raised">
                <span className="font-display text-2xl font-bold text-white/25">
                  {game.name.trim().charAt(0).toUpperCase() || 'G'}
                </span>
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-1.5 pt-4 pb-1">
              <p className="font-body text-[11px] leading-tight text-ink truncate">{game.name}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
