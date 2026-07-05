// Tiny procedural sound-effects engine. Everything here is synthesized with
// the Web Audio API rather than loaded from audio files — no assets to ship,
// nothing to license, and each cue is easy to keep sonically distinct from
// the others by construction (different waveform, pitch range, and shape).

let ctx;
let unlocked = false;

function ensureContext() {
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return null;
  if (!ctx) ctx = new AudioCtor();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

// Browsers only let an AudioContext actually produce sound after a genuine
// user gesture. Hovering a tile doesn't count as one, so we "unlock" audio
// on the very first real interaction (a keypress or click/controller press
// routed through a click handler) and every cue after that plays freely.
function unlockOnGesture() {
  if (unlocked) return;
  unlocked = true;
  ensureContext();
}
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', unlockOnGesture, { once: true });
  window.addEventListener('pointerdown', unlockOnGesture, { once: true });
}

// One short synthesized note with a click-free envelope.
function tone({ freq, freqEnd, duration = 0.08, type = 'sine', gain = 0.15, delay = 0 }) {
  const audioCtx = ensureContext();
  if (!audioCtx) return;

  const t0 = audioCtx.currentTime + delay;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), t0 + duration);

  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  osc.connect(g).connect(audioCtx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

// Quiet directional tick while browsing the shelf — pitch slides one way
// for "right", the other way for "left", so the two read as a mirrored
// pair rather than a single generic click.
export function playMoveSound(direction = 'right') {
  if (direction === 'left') {
    tone({ freq: 520, freqEnd: 400, duration: 0.05, type: 'triangle', gain: 0.07 });
  } else {
    tone({ freq: 400, freqEnd: 520, duration: 0.05, type: 'triangle', gain: 0.07 });
  }
}

// Bright rising two-note chime — launching a game is the "big" action, so
// this is louder, longer, and lower-pitched than the sparkle used for
// favoriting, keeping the two from blurring together.
export function playLaunchSound() {
  tone({ freq: 440, freqEnd: 660, duration: 0.12, type: 'sine', gain: 0.18 });
  tone({ freq: 660, freqEnd: 880, duration: 0.16, type: 'sine', gain: 0.16, delay: 0.09 });
}

// Favoriting: a quick high sparkle (two ascending notes, higher and
// shorter than the launch chime). Unfavoriting is a single soft descending
// blip — deliberately a one-note shape so it can't be mistaken for the
// two-note "on" sparkle.
export function playFavoriteSound(isFavorited) {
  if (isFavorited) {
    tone({ freq: 900, duration: 0.05, type: 'triangle', gain: 0.14 });
    tone({ freq: 1300, duration: 0.09, type: 'triangle', gain: 0.12, delay: 0.05 });
  } else {
    tone({ freq: 700, freqEnd: 480, duration: 0.09, type: 'sine', gain: 0.1 });
  }
}

// Controller plugged in: two quick ascending notes, cheerful but brief so it
// doesn't compete with whatever else is on screen.
export function playControllerConnectSound() {
  tone({ freq: 520, duration: 0.06, type: 'sine', gain: 0.12 });
  tone({ freq: 780, duration: 0.09, type: 'sine', gain: 0.12, delay: 0.06 });
}

// Controller unplugged: a single, low, slightly wistful descending note —
// deliberately the opposite shape of the connect chime.
export function playControllerDisconnectSound() {
  tone({ freq: 420, freqEnd: 260, duration: 0.14, type: 'sine', gain: 0.1 });
}

// Confirming a destructive action (e.g. remove): a short low thud, distinct
// from the bright launch/favorite cues so it reads as final, not celebratory.
export function playConfirmDestructiveSound() {
  tone({ freq: 220, freqEnd: 140, duration: 0.12, type: 'triangle', gain: 0.14 });
}
