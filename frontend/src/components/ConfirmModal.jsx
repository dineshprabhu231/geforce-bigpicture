import React from 'react';
import { useModalNav } from '../hooks/useModalNav.js';

// Generic confirm/cancel dialog, fully usable from a couch with just a
// controller: left/right (or the d-pad) moves between the two buttons, A
// picks whichever is highlighted, and B always cancels immediately —
// regardless of which button is focused — so backing out of a destructive
// action never requires precise aim.
export default function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}) {
  // Cancel starts focused — the safer default for anything destructive.
  const [index] = useModalNav({
    itemCount: 2,
    orientation: 'horizontal',
    initialIndex: 0,
    onActivate: (i) => (i === 0 ? onCancel() : onConfirm()),
    onCancel,
  });

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60" onClick={onCancel}>
      <div
        className="w-96 rounded-xl bg-panel-raised border border-white/10 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-lg font-bold text-ink mb-2">{title}</h3>
        <p className="font-body text-sm text-muted mb-6">{message}</p>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className={[
              'text-sm font-body px-4 py-2 rounded-lg border transition-colors',
              index === 0
                ? 'border-accent text-ink shadow-focus'
                : 'border-white/10 text-muted hover:border-accent hover:text-ink',
            ].join(' ')}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={[
              'text-sm font-body font-semibold px-4 py-2 rounded-lg transition-colors',
              destructive ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-accent hover:bg-accent-soft text-black',
              index === 1 ? 'shadow-focus' : '',
            ].join(' ')}
          >
            {confirmLabel}
          </button>
        </div>

        <p className="font-body text-[11px] text-muted mt-4 text-center">
          ←/→ choose · A/Enter select · B/Esc cancel
        </p>
      </div>
    </div>
  );
}
