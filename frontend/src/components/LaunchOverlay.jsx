import React, { useEffect } from 'react';
import LogoMark from './LogoMark.jsx';

// GeForce NOW itself can take up to roughly a minute to actually start
// streaming after we hand it the shortcut, so this overlay just reassures
// the person something is happening rather than leaving them staring at
// the grid wondering if the button press registered. It closes itself when
// the Electron window loses focus, which is the moment GeForce NOW has
// taken over the screen.

export default function LaunchOverlay({ gameName, onDismiss }) {
  useEffect(() => {
    const closeIfBlurred = () => {
      if (!document.hidden) return;
      onDismiss();
    };
    const onVisibilityChange = () => {
      if (document.hidden) onDismiss();
    };
    const onWindowBlur = () => {
      closeIfBlurred();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onWindowBlur);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onWindowBlur);
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

      <p className="font-mono text-xs text-muted">Waiting for GeForce NOW to take focus...</p>
    </div>
  );
}
