// Small shared helpers used by every gamepad-aware hook in the app, so the
// main navigation hook and any modal's own nav hook feel identical and never
// drift out of sync with each other.

// Global vibration preferences, set from Settings → Vibration. `weak` and
// `strong` are multipliers (0–1.5) applied on top of each individual rumble
// call's own magnitude — they don't replace it, so short taps still feel
// lighter than a big launch buzz, just scaled up or down by user preference.
// The "weak" motor is the larger low-frequency one (most controllers mount
// it toward the left grip); "strong" is the smaller high-frequency one
// (toward the right grip / triggers) — the closest thing standard gamepads
// expose to "which area vibrates".
let rumbleConfig = { enabled: true, weak: 1, strong: 1 };

export function setRumbleConfig(next = {}) {
  rumbleConfig = { ...rumbleConfig, ...next };
}

export function getRumbleConfig() {
  return rumbleConfig;
}

// Short haptic buzz for tactile feedback. Silently does nothing on
// controllers/browsers that don't expose the vibration actuator, or while
// vibration is turned off in Settings.
export function rumble(pad, { duration = 120, weakMagnitude = 0.3, strongMagnitude = 0.6 } = {}) {
  if (!rumbleConfig.enabled) return;
  const actuator = pad?.vibrationActuator;
  if (!actuator || typeof actuator.playEffect !== 'function') return;
  const weak = Math.max(0, Math.min(1, weakMagnitude * rumbleConfig.weak));
  const strong = Math.max(0, Math.min(1, strongMagnitude * rumbleConfig.strong));
  try {
    actuator.playEffect('dual-rumble', { duration, startDelay: 0, weakMagnitude: weak, strongMagnitude: strong });
  } catch {
    // Some controllers report support but throw anyway — never let a
    // cosmetic rumble crash navigation.
  }
}

// Two quick taps, distinct from any in-game rumble, so waking up a
// controller reads as "connected" rather than "you just favorited something".
export function rumbleConnectPulse(pad) {
  if (!pad) return;
  rumble(pad, { duration: 90, weakMagnitude: 0.45, strongMagnitude: 0.55 });
  setTimeout(() => rumble(pad, { duration: 90, weakMagnitude: 0.45, strongMagnitude: 0.55 }), 160);
}

export function detectPadType(id = '') {
  const lower = id.toLowerCase();
  if (lower.includes('054c') || lower.includes('dualsense') || lower.includes('dualshock')) {
    return 'playstation';
  }
  return 'xbox';
}

// Which physical action each named button performs — remappable from
// Settings → Controller. Indices follow the W3C Standard Gamepad layout.
// Only face buttons + bumpers/triggers are offered as remap targets; the
// d-pad and sticks stay fixed to navigation so the shelf is always steerable.
export const DEFAULT_CONTROLLER_MAP = { activate: 0, secondary: 2, tertiary: 3, back: 1 };

export const REMAPPABLE_BUTTONS = [0, 1, 2, 3, 4, 5, 6, 7];

// Display glyph for every remappable button index, per detected pad type —
// used both by the Settings remapping UI and by the bottom hint bar, so
// whatever the person binds an action to is what they see labeled on screen.
export const BUTTON_GLYPHS = {
  xbox: { 0: 'A', 1: 'B', 2: 'X', 3: 'Y', 4: 'LB', 5: 'RB', 6: 'LT', 7: 'RT' },
  playstation: { 0: '✕', 1: '○', 2: '□', 3: '△', 4: 'L1', 5: 'R1', 6: 'L2', 7: 'R2' },
};

export function buttonGlyph(padType, index) {
  return (BUTTON_GLYPHS[padType] || BUTTON_GLYPHS.xbox)[index] ?? '?';
}
