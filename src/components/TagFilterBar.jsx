import React from 'react';

// Minimal row of chips for filtering the grid down to one collection/tag at
// a time. Only rendered once at least one game has a tag.
export default function TagFilterBar({ tags, activeTag, onSelect }) {
  if (tags.length === 0) return null;

  return (
    <div className="flex items-center gap-2 px-10 pb-3 flex-shrink-0 overflow-x-auto">
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={[
          'text-xs font-body px-3 py-1.5 rounded-full border transition-colors flex-shrink-0',
          activeTag === null
            ? 'bg-accent text-black border-accent font-medium'
            : 'bg-panel-raised text-muted border-white/10 hover:border-accent hover:text-ink',
        ].join(' ')}
      >
        All
      </button>
      {tags.map((tag) => (
        <button
          key={tag}
          type="button"
          onClick={() => onSelect(tag)}
          className={[
            'text-xs font-body px-3 py-1.5 rounded-full border transition-colors flex-shrink-0',
            activeTag === tag
              ? 'bg-accent text-black border-accent font-medium'
              : 'bg-panel-raised text-muted border-white/10 hover:border-accent hover:text-ink',
          ].join(' ')}
        >
          {tag}
        </button>
      ))}
    </div>
  );
}
