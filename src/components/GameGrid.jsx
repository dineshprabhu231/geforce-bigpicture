import React from 'react';
import GameTile from './GameTile.jsx';

export default function GameGrid({ games, focusedIndex, fetchingArtId, onSelect, onSetImage, onFetchArtwork, onEditTags, onRemove, onHover, onFocusHover, rowRef }) {
  return (
    <div className="flex-1 flex items-center min-h-0">
      <div
        ref={rowRef}
        className="flex gap-5 px-10 py-4 overflow-x-auto w-full scroll-smooth"
        style={{ scrollSnapType: 'x proximity' }}
      >
        {games.map((game, i) => (
          <div
            key={game.id}
            style={{ scrollSnapAlign: 'center' }}
            onMouseEnter={() => { onHover && onHover(game.id); onFocusHover && onFocusHover(i); }}
            onMouseLeave={() => onHover && onHover(null)}
          >
            <GameTile
              game={game}
              focused={i === focusedIndex}
              fetchingArt={fetchingArtId === game.id}
              onSelect={() => onSelect(i)}
              onSetImage={() => onSetImage(i)}
              onFetchArtwork={() => onFetchArtwork(i)}
              onEditTags={() => onEditTags(i)}
              onRemove={() => onRemove(i)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
