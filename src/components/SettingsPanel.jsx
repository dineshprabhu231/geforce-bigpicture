import React, { useEffect, useState } from 'react';

export default function SettingsPanel({ apiKey, autoLaunch, onSave, onToggleAutoLaunch, onClose }) {
  const [value, setValue] = useState(apiKey || '');

  useEffect(() => setValue(apiKey || ''), [apiKey]);

  return (
    <div className="absolute inset-0 z-30 flex items-start justify-end p-6 bg-black/40" onClick={onClose}>
      <div
        className="w-96 rounded-xl bg-panel-raised border border-white/10 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-lg font-bold text-ink mb-1">Automatic artwork</h3>
        <p className="font-body text-sm text-muted mb-4">
          Paste a free SteamGridDB API key to let the app fetch box art for
          you automatically, matched by shortcut name. Get one at{' '}
          <span className="text-accent-soft">steamgriddb.com/profile/preferences/api</span>.
        </p>
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="SteamGridDB API key"
          className="w-full mb-5 px-3 py-2 rounded-lg bg-void border border-white/10 text-ink text-sm font-body focus:outline-none focus:border-accent"
        />

        <div className="border-t border-white/10 pt-4 mb-5">
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

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="text-sm font-body px-4 py-2 rounded-lg border border-white/10 hover:border-accent transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(value.trim())}
            className="text-sm font-body font-semibold px-4 py-2 rounded-lg bg-accent text-black hover:bg-accent-soft transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
