import React from 'react';
import { BUTTON_GLYPHS, DEFAULT_CONTROLLER_MAP } from '../utils/gamepad.js';

const KEYBOARD_GLYPHS = { primary: '↵', secondary: 'Space', tertiary: 'I', back: 'Del' };

// Small inline controller glyph — no emoji, renders crisp at any size and
// always matches the accent color instead of an emoji font's own colors.
function ControllerIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M7 8h3M8.5 6.5v3M14.5 9.5h.01M17 7.5h.01M5.5 8c-1.4 0-2.6 1-2.9 2.4l-1 4.6c-.3 1.4.8 2.7 2.2 2.7.6 0 1.2-.3 1.6-.7l1.6-1.8c.4-.5 1-.7 1.6-.7h6.8c.6 0 1.2.2 1.6.7l1.6 1.8c.4.5 1 .7 1.6.7 1.4 0 2.5-1.3 2.2-2.7l-1-4.6C20.1 9 18.9 8 17.5 8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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

export default function ControlHints({
  inputMethod,
  zone = 'grid',
  gamepadConnected,
  buttonMap = DEFAULT_CONTROLLER_MAP,
}) {
  const isKeyboard = inputMethod === 'keyboard';
  const padGlyphs = BUTTON_GLYPHS[inputMethod] || BUTTON_GLYPHS.xbox;

  // Look glyphs up by whichever physical button is currently bound to each
  // action (Settings → Controller), so a remapped controller shows the
  // right prompt instead of an assumed A/X/Y/B.
  const glyphs = isKeyboard
    ? KEYBOARD_GLYPHS
    : {
        primary: padGlyphs[buttonMap.activate],
        secondary: padGlyphs[buttonMap.secondary],
        tertiary: padGlyphs[buttonMap.tertiary],
        back: padGlyphs[buttonMap.back],
      };
  const vertGlyph = isKeyboard ? '↑↓' : '⇅';

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
        {gamepadConnected && <ControllerIcon className="w-4 h-4 text-accent flex-shrink-0" />}
      </div>
      <div className="flex items-center justify-center gap-7">
        <Hint glyph={vertGlyph} label="Menu" />
        {zoneHints}
      </div>
      <div />
    </div>
  );
}
