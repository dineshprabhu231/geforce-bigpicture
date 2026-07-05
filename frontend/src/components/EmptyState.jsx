import React from 'react';

export default function EmptyState({ onAddFolder, onAddManual, scanning }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-10">
      <h2 className="font-display text-3xl font-bold text-ink mb-2">No games found yet</h2>
      <p className="font-body text-muted max-w-md mb-8">
        Point us at the folder where you keep your GeForce NOW shortcuts, or
        add one shortcut file at a time.
      </p>
      <div className="flex gap-4">
        <button
          onClick={onAddFolder}
          disabled={scanning}
          className="font-body font-semibold px-6 py-3 rounded-lg bg-accent text-black hover:bg-accent-soft transition-colors disabled:opacity-50"
        >
          {scanning ? 'Importing…' : 'Import folder'}
        </button>
        <button
          onClick={onAddManual}
          className="font-body font-semibold px-6 py-3 rounded-lg bg-panel-raised text-ink border border-white/10 hover:border-accent transition-colors"
        >
          Add shortcut manually
        </button>
      </div>
    </div>
  );
}
