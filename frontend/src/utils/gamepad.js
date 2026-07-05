// Small shared helpers used by every gamepad-aware hook in the app, so the
// main navigation hook and any modal's own nav hook feel identical and never
// drift out of sync with each other.

// Short haptic buzz for tactile feedback. Silently does nothing on
// controllers/browsers that don't expose the vibration actuator.
export function rumble(pad, { duration = 120, weakMagnitude = 0.3, strongMagnitude = 0.6 } = {}) {
  const actuator = pad?.vibrationActuator;
  if (!actuator || typeof actuator.playEffect !== 'function') return;
  try {
    actuator.playEffect('dual-rumble', { duration, startDelay: 0, weakMagnitude, strongMagnitude });
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
