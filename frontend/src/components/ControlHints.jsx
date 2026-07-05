import React from 'react';

const GLYPHS = {
  xbox: { primary: 'A', secondary: 'X', tertiary: 'Y' },
  playstation: { primary: '✕', secondary: '□', tertiary: '△' },
  keyboard: { primary: '↵', secondary: 'Space', tertiary: 'I' },
};

function Hint({ glyph, label }) {
  return (
    <span className="flex items-center gap-2 text-muted">
      <span className="font-mono text-xs font-bold text-ink bg-panel-raised border border-white/10 rounded-full min-w-6 h-6 px-2 flex items-center justify-center">
        {glyph}
      </span>
      <span className="text-sm font-body">{label}</span>
    </span>
  );
}

export default function ControlHints({ inputMethod, gameName }) {
  const glyphs = GLYPHS[inputMethod] || GLYPHS.keyboard;
  return (
    <div className="fixed bottom-0 inset-x-0 h-16 bg-panel/95 backdrop-blur border-t border-white/5 flex items-center justify-between px-8">
      <div className="text-sm font-body text-muted truncate max-w-[35%]">
        {gameName ? <span className="text-ink font-medium">{gameName}</span> : 'Big Picture for GeForce NOW'}
      </div>
      <div className="flex items-center gap-6">
        <Hint glyph={glyphs.primary} label="Launch" />
        <Hint glyph={glyphs.secondary} label="Favorite" />
        <Hint glyph={glyphs.tertiary} label="Set artwork" />
      </div>
    </div>
  );
}
