import React, { useState } from 'react';
import { useModalNav } from '../hooks/useModalNav.js';

// Small popover for assigning collections/tags (e.g. "co-op", "roguelike")
// to a single game. Existing tags across the library show up as one-tap
// toggle chips; typing a new name and hitting Enter/Add creates one.
export default function TagEditor({ game, allTags, onSave, onClose }) {
  const [tags, setTags] = useState(game.tags || []);
  const [draft, setDraft] = useState('');

  // Tag chips aren't roving-focus navigable yet (this popover leans on
  // mouse/touch for now), but B/Escape closing it from a controller is
  // table stakes so it never becomes a dead end on a couch.
  useModalNav({ itemCount: 1, onActivate: () => {}, onCancel: onClose });

  const toggle = (tag) => {
    setTags((cur) => (cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag]));
  };

  const addDraft = () => {
    const clean = draft.trim();
    if (!clean) return;
    setTags((cur) => (cur.includes(clean) ? cur : [...cur, clean]));
    setDraft('');
  };

  const otherTags = allTags.filter((t) => !tags.includes(t));

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-80 rounded-xl bg-panel-raised border border-white/10 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-lg font-bold text-ink mb-1 truncate">{game.name}</h3>
        <p className="font-body text-sm text-muted mb-3">Tag this into a collection.</p>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggle(tag)}
                className="text-xs font-body px-2.5 py-1 rounded-full bg-accent text-black font-medium"
              >
                {tag} ✕
              </button>
            ))}
          </div>
        )}

        {otherTags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {otherTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggle(tag)}
                className="text-xs font-body px-2.5 py-1 rounded-full bg-void border border-white/10 text-muted hover:border-accent hover:text-ink transition-colors"
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); addDraft(); }
            }}
            placeholder="New tag…"
            className="flex-1 px-3 py-2 rounded-lg bg-void border border-white/10 text-ink text-sm font-body focus:outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={addDraft}
            className="text-sm font-body px-3 py-2 rounded-lg bg-void border border-white/10 hover:border-accent transition-colors"
          >
            Add
          </button>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="text-sm font-body px-4 py-2 rounded-lg border border-white/10 hover:border-accent transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(tags)}
            className="text-sm font-body font-semibold px-4 py-2 rounded-lg bg-accent text-black hover:bg-accent-soft transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
