import React from 'react';

const GLYPHS = {
  xbox: { primary: 'A', secondary: 'X', tertiary: 'Y', back: 'B' },
  playstation: { primary: '✕', secondary: '□', tertiary: '△', back: '○' },
  keyboard: { primary: '↵', secondary: 'Space', tertiary: 'I', back: 'Del' },
};

function Hint({ glyph, label }) {
  return (
    <span className="flex items-center gap-2.5 text-muted">
      <span className="font-mono text-sm font-bold text-ink bg-panel-raised border border-white/10 rounded-full min-w-9 h-9 px-3 flex items-center justify-center">
        {glyph}
      </span>
      <span className="text-base font-body">{label}</span>
    </span>
  );
}

export default function ControlHints({ inputMethod, gameName, zone = 'grid', gamepadConnected }) {
  const glyphs = GLYPHS[inputMethod] || GLYPHS.keyboard;
  const vertGlyph = inputMethod === 'keyboard' ? '↑↓' : '⇅';

  let zoneHints;
  if (zone === 'header') {
    zoneHints = <Hint glyph={glyphs.primary} label="Select" />;
  } else if (zone === 'filters') {
    zoneHints = <Hint glyph={glyphs.primary} label="Filter" />;
  } else {
    zoneHints = (
      <>
        <Hint glyph={glyphs.primary} label="Launch" />
        <Hint glyph={glyphs.secondary} label="Favorite" />
        <Hint glyph={glyphs.tertiary} label="Set artwork" />
        <Hint glyph={glyphs.back} label="Remove" />
      </>
    );
  }

  return (
    <div className="fixed bottom-0 inset-x-0 h-20 bg-panel/95 backdrop-blur border-t border-white/5 grid grid-cols-3 items-center px-8">
      <div className="text-sm font-body text-muted truncate flex items-center gap-2">
        {gamepadConnected && (
          <span className="text-accent" title="Controller connected" aria-hidden>🎮</span>
        )}
        {gameName ? <span className="text-ink font-medium">{gameName}</span> : 'Big Picture for GeForce NOW'}
      </div>
      <div className="flex items-center justify-center gap-7">
        <Hint glyph={vertGlyph} label="Menu" />
        {zoneHints}
      </div>
      <div />
    </div>
  );
}
