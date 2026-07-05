import { useEffect, useRef, useState, useCallback } from 'react';
import { playMoveSound } from '../utils/sfx.js';

const STICK_DEADZONE = 0.5;
const REPEAT_DELAY_MS = 260; // time before a held direction starts repeating
const REPEAT_RATE_MS = 130;

// Short haptic buzz for tactile feedback. Silently does nothing on
// controllers/browsers that don't expose the vibration actuator.
function rumble(pad, { duration = 120, weakMagnitude = 0.3, strongMagnitude = 0.6 } = {}) {
  const actuator = pad?.vibrationActuator;
  if (!actuator || typeof actuator.playEffect !== 'function') return;
  try {
    actuator.playEffect('dual-rumble', { duration, startDelay: 0, weakMagnitude, strongMagnitude });
  } catch {
    // Some controllers report support but throw anyway — never let a
    // cosmetic rumble crash navigation.
  }
}

/**
 * Drives horizontal-row navigation from either a connected gamepad or the
 * keyboard, and tracks which input method was used most recently so the UI
 * can show the right button glyphs — switching back to keyboard hints the
 * moment a key is pressed, even after a controller was used earlier.
 *
 * @param {number} itemCount total number of focusable tiles
 * @param {(index:number)=>void} onActivate A / Enter — launch
 * @param {(index:number)=>void} onSecondary X / Space — favorite
 * @param {(index:number)=>void} onTertiary Y / "i" — set custom artwork
 */
export function useGamepadNavigation(itemCount, onActivate, onSecondary, onTertiary) {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [inputMethod, setInputMethod] = useState('keyboard'); // 'keyboard' | 'xbox' | 'playstation'
  const stateRef = useRef({
    lastDir: null,
    lastMoveTime: 0,
    prevButtons: {},
  });
  // Only auto-fullscreen once per session — if the person manually exits
  // (Escape) we shouldn't fight them every time the poll loop notices the
  // controller is still plugged in.
  const autoFullscreenedRef = useRef(false);
  // Mirrors focusedIndex synchronously (state updates are async) so both
  // the keyboard/gamepad mover and the mouse-hover mover can read "where
  // focus currently is" without stale closures.
  const focusedIndexRef = useRef(0);
  useEffect(() => { focusedIndexRef.current = focusedIndex; }, [focusedIndex]);
  // Whatever gamepad the poll loop last saw connected, if any — lets mouse
  // hover fire a haptic tick on a controller even though the hover itself
  // didn't come from that controller.
  const latestPadRef = useRef(null);

  useEffect(() => {
    setFocusedIndex((i) => Math.min(i, Math.max(itemCount - 1, 0)));
  }, [itemCount]);

  const move = (dir) => {
    if (itemCount === 0) return;
    const current = focusedIndexRef.current;
    const next = dir === 'left' ? current - 1 : current + 1;
    const clamped = Math.max(0, Math.min(itemCount - 1, next));
    if (clamped === current) return;
    playMoveSound(dir);
    rumble(latestPadRef.current, { duration: 30, weakMagnitude: 0.1, strongMagnitude: 0.05 });
    setFocusedIndex(clamped);
  };

  // Mouse hover over a tile moves focus the same way a d-pad nudge would —
  // same tick sound and haptic buzz, direction inferred from which way the
  // focus moved along the shelf.
  const focusHover = useCallback((newIndex) => {
    if (itemCount === 0) return;
    const current = focusedIndexRef.current;
    const clamped = Math.max(0, Math.min(itemCount - 1, newIndex));
    if (clamped === current) return;
    playMoveSound(clamped > current ? 'right' : 'left');
    rumble(latestPadRef.current, { duration: 30, weakMagnitude: 0.1, strongMagnitude: 0.05 });
    setFocusedIndex(clamped);
  }, [itemCount]);

  // Keyboard input
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') { window.gfnLauncher?.setFullscreen?.(false); return; }
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return; // let the search box etc. handle its own keys
      switch (e.key) {
        case 'ArrowLeft': setInputMethod('keyboard'); move('left'); break;
        case 'ArrowRight': setInputMethod('keyboard'); move('right'); break;
        case 'Enter': setInputMethod('keyboard'); onActivate(focusedIndex); break;
        case ' ': setInputMethod('keyboard'); onSecondary && onSecondary(focusedIndex); break;
        case 'i': case 'I': setInputMethod('keyboard'); onTertiary && onTertiary(focusedIndex); break;
        default: return;
      }
      e.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedIndex, itemCount]);

  // Gamepad polling loop
  useEffect(() => {
    let rafId;

    const detectType = (id = '') => {
      const lower = id.toLowerCase();
      if (lower.includes('054c') || lower.includes('dualsense') || lower.includes('dualshock')) {
        return 'playstation';
      }
      return 'xbox';
    };

    const poll = () => {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      const pad = Array.from(pads).find(Boolean);
      latestPadRef.current = pad || null;

      if (pad) {
        if (!autoFullscreenedRef.current) {
          autoFullscreenedRef.current = true;
          window.gfnLauncher?.setFullscreen?.(true);
        }

        const axisX = pad.axes[0] || 0;
        const dpadLeft = pad.buttons[14]?.pressed;
        const dpadRight = pad.buttons[15]?.pressed;

        let dir = null;
        if (dpadLeft || axisX < -STICK_DEADZONE) dir = 'left';
        else if (dpadRight || axisX > STICK_DEADZONE) dir = 'right';

        const now = performance.now();
        const s = stateRef.current;
        if (dir) {
          setInputMethod(detectType(pad.id));
          if (dir !== s.lastDir) {
            move(dir);
            s.lastDir = dir;
            s.lastMoveTime = now;
          } else {
            const sinceLast = now - s.lastMoveTime;
            if (sinceLast > REPEAT_DELAY_MS && (sinceLast - REPEAT_DELAY_MS) % REPEAT_RATE_MS < 16) {
              move(dir);
            }
          }
        } else {
          s.lastDir = null;
        }

        // 0 = A/Cross, 2 = X/Square, 3 = Y/Triangle
        const aPressed = pad.buttons[0]?.pressed;
        const xPressed = pad.buttons[2]?.pressed;
        const yPressed = pad.buttons[3]?.pressed;
        if (aPressed && !s.prevButtons[0]) {
          setInputMethod(detectType(pad.id));
          rumble(pad, { duration: 140, weakMagnitude: 0.3, strongMagnitude: 0.7 });
          onActivate(focusedIndex);
        }
        if (xPressed && !s.prevButtons[2]) {
          setInputMethod(detectType(pad.id));
          rumble(pad, { duration: 70, weakMagnitude: 0.15, strongMagnitude: 0.25 });
          onSecondary && onSecondary(focusedIndex);
        }
        if (yPressed && !s.prevButtons[3]) { setInputMethod(detectType(pad.id)); onTertiary && onTertiary(focusedIndex); }
        s.prevButtons = { 0: aPressed, 2: xPressed, 3: yPressed };
      }

      rafId = requestAnimationFrame(poll);
    };

    rafId = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedIndex, itemCount]);

  return { focusedIndex, setFocusedIndex, focusHover, inputMethod };
}
