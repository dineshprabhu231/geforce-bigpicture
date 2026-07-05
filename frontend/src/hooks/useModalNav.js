import { useEffect, useRef, useState } from 'react';
import { playMoveSound } from '../utils/sfx.js';
import { rumble } from '../utils/gamepad.js';

const STICK_DEADZONE = 0.5;
const REPEAT_DELAY_MS = 260;
const REPEAT_RATE_MS = 130;

/**
 * Minimal roving-focus navigation for a modal dialog — a handful of items
 * arranged in a single row (buttons side by side) or column (stacked
 * controls), moved between with the d-pad/stick/arrow keys, chosen with
 * A/Enter, and dismissed with B/Escape. Every modal in the app (confirm
 * dialogs, settings) shares this so a controller feels the same everywhere.
 *
 * @param {number} itemCount how many focusable items the modal has
 * @param {'horizontal'|'vertical'} orientation which axis moves between them
 * @param {number} initialIndex which item starts focused
 * @param {(index:number)=>void} onActivate A/Enter on the focused item
 * @param {()=>void} onCancel B/Escape — dismiss without acting
 */
export function useModalNav({ itemCount, orientation = 'horizontal', initialIndex = 0, onActivate, onCancel }) {
  const [index, setIndex] = useState(Math.min(initialIndex, Math.max(itemCount - 1, 0)));
  const indexRef = useRef(index);
  useEffect(() => { indexRef.current = index; }, [index]);
  const stateRef = useRef({ lastDir: null, lastMoveTime: 0, prevButtons: {} });
  const padRef = useRef(null);

  const move = (dir) => {
    if (itemCount === 0) return;
    const current = indexRef.current;
    const next = dir === 'prev' ? current - 1 : current + 1;
    const clamped = Math.max(0, Math.min(itemCount - 1, next));
    if (clamped === current) return;
    playMoveSound(dir === 'prev' ? 'left' : 'right');
    rumble(padRef.current, { duration: 25, weakMagnitude: 0.08, strongMagnitude: 0.04 });
    setIndex(clamped);
  };

  // Keyboard
  useEffect(() => {
    const prevKey = orientation === 'horizontal' ? 'ArrowLeft' : 'ArrowUp';
    const nextKey = orientation === 'horizontal' ? 'ArrowRight' : 'ArrowDown';
    const onKeyDown = (e) => {
      // Escape always cancels, even while typing in a text field. Everything
      // else (arrows/Tab/Enter) is left alone while a text field has focus,
      // so typing a tag name etc. isn't hijacked by roving-focus navigation.
      if (e.key === 'Escape') { onCancel && onCancel(); e.preventDefault(); return; }
      const targetTag = e.target?.tagName;
      if (targetTag === 'INPUT' || targetTag === 'TEXTAREA') return;
      if (e.key === prevKey) { move('prev'); e.preventDefault(); }
      else if (e.key === nextKey) { move('next'); e.preventDefault(); }
      else if (e.key === 'Tab') { move(e.shiftKey ? 'prev' : 'next'); e.preventDefault(); }
      else if (e.key === 'Enter') { onActivate && onActivate(indexRef.current); e.preventDefault(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemCount, orientation, onActivate, onCancel]);

  // Gamepad
  useEffect(() => {
    let rafId;
    const poll = () => {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      const pad = Array.from(pads).find(Boolean);
      padRef.current = pad || null;

      if (pad) {
        const axis = orientation === 'horizontal' ? (pad.axes[0] || 0) : (pad.axes[1] || 0);
        const prevPressed = orientation === 'horizontal' ? pad.buttons[14]?.pressed : pad.buttons[12]?.pressed;
        const nextPressed = orientation === 'horizontal' ? pad.buttons[15]?.pressed : pad.buttons[13]?.pressed;

        let dir = null;
        if (prevPressed || axis < -STICK_DEADZONE) dir = 'prev';
        else if (nextPressed || axis > STICK_DEADZONE) dir = 'next';

        const now = performance.now();
        const s = stateRef.current;
        if (dir) {
          if (dir !== s.lastDir) { move(dir); s.lastDir = dir; s.lastMoveTime = now; }
          else {
            const sinceLast = now - s.lastMoveTime;
            if (sinceLast > REPEAT_DELAY_MS && (sinceLast - REPEAT_DELAY_MS) % REPEAT_RATE_MS < 16) move(dir);
          }
        } else {
          s.lastDir = null;
        }

        const aPressed = pad.buttons[0]?.pressed;
        const bPressed = pad.buttons[1]?.pressed;
        if (aPressed && !s.prevButtons[0]) {
          rumble(pad, { duration: 90, weakMagnitude: 0.2, strongMagnitude: 0.4 });
          onActivate && onActivate(indexRef.current);
        }
        if (bPressed && !s.prevButtons[1]) {
          rumble(pad, { duration: 60, weakMagnitude: 0.15, strongMagnitude: 0.15 });
          onCancel && onCancel();
        }
        s.prevButtons = { 0: aPressed, 1: bPressed };
      }

      rafId = requestAnimationFrame(poll);
    };
    rafId = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemCount, orientation, onActivate, onCancel]);

  return [index, setIndex];
}
