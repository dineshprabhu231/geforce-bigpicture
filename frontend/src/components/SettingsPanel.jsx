import React from 'react';

export default function SettingsPanel({ autoLaunch, onToggleAutoLaunch, onClose }) {
  return (
    <div className="absolute inset-0 z-30 flex items-start justify-end p-6 bg-black/40" onClick={onClose}>
      <div
        className="w-96 rounded-xl bg-panel-raised border border-white/10 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-lg font-bold text-ink mb-1">Automatic artwork</h3>
        <p className="font-body text-sm text-muted mb-5">
          Box art is fetched automatically through GFN Launcher's own artwork
          service — no API key or setup needed.
        </p>

        <div className="border-t border-white/10 pt-4 mb-1">
          <h3 className="font-display text-lg font-bold text-ink mb-1">Startup</h3>
          <label className="flex items-start gap-3 mt-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!autoLaunch}
              onChange={(e) => onToggleAutoLaunch(e.target.checked)}
              className="mt-1 w-4 h-4 accent-accent"
            />
            <span className="font-body text-sm text-muted">
              Launch fullscreen on Windows startup — boots straight into Big
              Picture, no clicking required.
            </span>
          </label>
        </div>

        <div className="flex justify-end pt-5">
          <button
            onClick={onClose}
            className="text-sm font-body font-semibold px-4 py-2 rounded-lg bg-accent text-black hover:bg-accent-soft transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
