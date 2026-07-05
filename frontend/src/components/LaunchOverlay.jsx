import React, { useEffect } from 'react';
import LogoMark from './LogoMark.jsx';

// GeForce NOW itself can take up to roughly a minute to actually start
// streaming after we hand it the shortcut, so this overlay just reassures
// the person something is happening rather than leaving them staring at
// the grid wondering if the button press registered. It closes itself
// after a while, or immediately if they dismiss it (Esc / B / click).
const AUTO_DISMISS_MS = 60_000;

export default function LaunchOverlay({ gameName, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);

    const onKeyDown = (e) => {
      if (e.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', onKeyDown);

    // Also let a controller's B/Circle button dismiss it, since someone
    // sitting back on a couch may not have a keyboard in reach.
    let rafId;
    const poll = () => {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      const pad = Array.from(pads).find(Boolean);
      if (pad?.buttons[1]?.pressed) {
        onDismiss();
        return;
      }
      rafId = requestAnimationFrame(poll);
    };
    rafId = requestAnimationFrame(poll);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', onKeyDown);
      cancelAnimationFrame(rafId);
    };
  }, [onDismiss]);

  return (
    <div className="fixed inset-0 z-50 bg-void/95 backdrop-blur flex flex-col items-center justify-center gap-8">
      <div className="flex items-center gap-3">
        <LogoMark className="w-12 h-12" />
        <span className="font-display text-2xl font-bold tracking-wide text-ink">
          Big Picture <span className="text-accent">for GeForce NOW</span>
        </span>
      </div>

      <div className="w-16 h-16 rounded-full border-[5px] border-white/10 border-t-accent animate-spin" />

      <div className="text-center px-6">
        <p className="font-display text-xl font-bold text-ink truncate max-w-md">{gameName}</p>
        <p className="font-body text-muted text-sm mt-2 max-w-sm">
          Launching in GeForce NOW — this can take up to a minute while it
          connects you to a server.
        </p>
      </div>

      <button
        onClick={onDismiss}
        className="font-mono text-xs text-muted border border-white/10 rounded-full px-4 py-2 hover:border-accent hover:text-ink transition-colors"
      >
        B / Esc to dismiss
      </button>
    </div>
  );
}
