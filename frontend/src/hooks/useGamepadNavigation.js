import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { playMoveSound } from '../utils/sfx.js';
import { rumble, detectPadType, rumbleConnectPulse } from '../utils/gamepad.js';

const STICK_DEADZONE = 0.5;
const REPEAT_DELAY_MS = 260; // time before a held direction starts repeating
const REPEAT_RATE_MS = 130;

/**
 * Drives every bit of controller/keyboard navigation for the main screen —
 * not just the game shelf. The UI is a vertical stack of three "zones"
 * (header buttons at the top, the collection filter chips below that, and
 * the horizontal game shelf at the bottom); d-pad/stick up-down steps
 * between zones, left-right moves within whichever zone is active, and A/X/Y/B
 * act on the game shelf specifically. Zones with nothing in them (no tags,
 * no header buttons) are skipped when stepping between them.
 *
 * @param {object} opts
 * @param {number} opts.gridCount number of tiles in the game shelf
 * @param {number} opts.headerCount number of focusable header controls
 * @param {number} opts.filterCount number of filter chips (0 disables the zone)
 * @param {boolean} opts.disabled true while a modal owns input (pauses this hook entirely)
 * @param {(index:number)=>void} opts.onGridActivate A / Enter on a tile — launch
 * @param {(index:number)=>void} opts.onGridSecondary X / Space on a tile — favorite
 * @param {(index:number)=>void} opts.onGridTertiary Y / "i" on a tile — set artwork
 * @param {(index:number)=>void} opts.onGridRemove B / Delete on a tile — remove (with confirmation)
 * @param {(index:number)=>void} opts.onHeaderActivate A / Enter on a header control
 * @param {(index:number)=>void} opts.onFilterActivate A / Enter on a filter chip
 * @param {(pad:Gamepad)=>void} opts.onGamepadConnect fires once per physical connect
 * @param {(pad:Gamepad|null)=>void} opts.onGamepadDisconnect fires when the last pad disconnects
 */
export function useGamepadNavigation({
  gridCount,
  headerCount = 0,
  filterCount = 0,
  disabled = false,
  onGridActivate,
  onGridSecondary,
  onGridTertiary,
  onGridRemove,
  onHeaderActivate,
  onFilterActivate,
  onGamepadConnect,
  onGamepadDisconnect,
}) {
  const [zone, setZone] = useState('grid'); // 'header' | 'filters' | 'grid'
  const [gridIndex, setGridIndex] = useState(0);
  const [headerIndex, setHeaderIndex] = useState(0);
  const [filterIndex, setFilterIndex] = useState(0);
  const [inputMethod, setInputMethod] = useState('keyboard'); // 'keyboard' | 'xbox' | 'playstation'
  const [gamepadConnected, setGamepadConnected] = useState(false);

  // Zones stack top-to-bottom as: header, filters, grid. Only zones that
  // currently have items are steppable; the grid is always present as the
  // floor of the stack.
  const zoneOrder = useMemo(() => {
    const order = [];
    if (headerCount > 0) order.push('header');
    if (filterCount > 0) order.push('filters');
    order.push('grid');
    return order;
  }, [headerCount, filterCount]);

  const zoneRef = useRef(zone);
  useEffect(() => { zoneRef.current = zone; }, [zone]);
  const gridIndexRef = useRef(0);
  useEffect(() => { gridIndexRef.current = gridIndex; }, [gridIndex]);
  const headerIndexRef = useRef(0);
  useEffect(() => { headerIndexRef.current = headerIndex; }, [headerIndex]);
  const filterIndexRef = useRef(0);
  useEffect(() => { filterIndexRef.current = filterIndex; }, [filterIndex]);

  const stateRef = useRef({ lastDir: null, lastMoveTime: 0, lastVertDir: null, prevButtons: {} });
  // Only auto-fullscreen once per session — if the person manually exits
  // (Escape) we shouldn't fight them every time the poll loop notices the
  // controller is still plugged in.
  const autoFullscreenedRef = useRef(false);
  // Mirrors whatever gamepad the poll loop last saw connected, if any — lets
  // mouse hover fire a haptic tick on a controller even though the hover
  // itself didn't come from that controller.
  const latestPadRef = useRef(null);

  // Clamp each zone's index if its item count shrinks (search narrows the
  // shelf, a tag gets removed, etc.), and fall back to the grid if the zone
  // we were in disappears entirely.
  useEffect(() => { setGridIndex((i) => Math.min(i, Math.max(gridCount - 1, 0))); }, [gridCount]);
  useEffect(() => { setHeaderIndex((i) => Math.min(i, Math.max(headerCount - 1, 0))); }, [headerCount]);
  useEffect(() => { setFilterIndex((i) => Math.min(i, Math.max(filterCount - 1, 0))); }, [filterCount]);
  useEffect(() => {
    if (!zoneOrder.includes(zoneRef.current)) setZone('grid');
  }, [zoneOrder]);

  const moveHorizontal = useCallback((dir) => {
    const currentZone = zoneRef.current;
    const count = currentZone === 'header' ? headerCount : currentZone === 'filters' ? filterCount : gridCount;
    if (count === 0) return;
    const ref = currentZone === 'header' ? headerIndexRef : currentZone === 'filters' ? filterIndexRef : gridIndexRef;
    const setter = currentZone === 'header' ? setHeaderIndex : currentZone === 'filters' ? setFilterIndex : setGridIndex;
    const current = ref.current;
    const next = dir === 'left' ? current - 1 : current + 1;
    const clamped = Math.max(0, Math.min(count - 1, next));
    if (clamped === current) return;
    playMoveSound(dir);
    rumble(latestPadRef.current, { duration: 30, weakMagnitude: 0.1, strongMagnitude: 0.05 });
    setter(clamped);
  }, [headerCount, filterCount, gridCount]);

  const moveVertical = useCallback((dir) => {
    const order = zoneOrder;
    const idx = order.indexOf(zoneRef.current);
    if (idx === -1) return;
    // "up" walks toward the header (index 0), "down" walks toward the grid
    // (the last index) — matches the actual on-screen layout.
    const nextIdx = dir === 'up' ? idx - 1 : idx + 1;
    const clamped = Math.max(0, Math.min(order.length - 1, nextIdx));
    if (clamped === idx) return;
    playMoveSound(dir === 'up' ? 'left' : 'right');
    rumble(latestPadRef.current, { duration: 40, weakMagnitude: 0.15, strongMagnitude: 0.1 });
    setZone(order[clamped]);
  }, [zoneOrder]);

  // Mouse hover over a tile moves grid focus the same way a d-pad nudge
  // would — same tick sound and haptic buzz — and pulls focus back to the
  // grid zone if it was elsewhere.
  const focusHover = useCallback((newIndex) => {
    if (gridCount === 0) return;
    const current = gridIndexRef.current;
    const clamped = Math.max(0, Math.min(gridCount - 1, newIndex));
    setZone('grid');
    if (clamped === current) return;
    playMoveSound(clamped > current ? 'right' : 'left');
    rumble(latestPadRef.current, { duration: 30, weakMagnitude: 0.1, strongMagnitude: 0.05 });
    setGridIndex(clamped);
  }, [gridCount]);

  const activate = useCallback(() => {
    const z = zoneRef.current;
    if (z === 'header') onHeaderActivate && onHeaderActivate(headerIndexRef.current);
    else if (z === 'filters') onFilterActivate && onFilterActivate(filterIndexRef.current);
    else onGridActivate && onGridActivate(gridIndexRef.current);
  }, [onHeaderActivate, onFilterActivate, onGridActivate]);

  // Keyboard input
  useEffect(() => {
    if (disabled) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') { window.gfnLauncher?.setFullscreen?.(false); return; }
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return; // let the search box etc. handle its own keys
      switch (e.key) {
        case 'ArrowLeft': setInputMethod('keyboard'); moveHorizontal('left'); break;
        case 'ArrowRight': setInputMethod('keyboard'); moveHorizontal('right'); break;
        case 'ArrowUp': setInputMethod('keyboard'); moveVertical('up'); break;
        case 'ArrowDown': setInputMethod('keyboard'); moveVertical('down'); break;
        case 'Enter': setInputMethod('keyboard'); activate(); break;
        case ' ':
          setInputMethod('keyboard');
          if (zoneRef.current === 'grid') onGridSecondary && onGridSecondary(gridIndexRef.current);
          break;
        case 'i': case 'I':
          setInputMethod('keyboard');
          if (zoneRef.current === 'grid') onGridTertiary && onGridTertiary(gridIndexRef.current);
          break;
        case 'Delete': case 'Backspace':
          setInputMethod('keyboard');
          if (zoneRef.current === 'grid') onGridRemove && onGridRemove(gridIndexRef.current);
          break;
        default: return;
      }
      e.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [disabled, moveHorizontal, moveVertical, activate, onGridSecondary, onGridTertiary, onGridRemove]);

  // Gamepad connect/disconnect — event-driven (not polled) so the toast and
  // rumble land the instant a controller wakes up or drops out, rather than
  // waiting for the next animation frame to notice.
  useEffect(() => {
    const onConnect = (e) => {
      setGamepadConnected(true);
      setInputMethod(detectPadType(e.gamepad?.id));
      rumbleConnectPulse(e.gamepad);
      onGamepadConnect && onGamepadConnect(e.gamepad);
    };
    const onDisconnect = (e) => {
      const stillConnected = navigator.getGamepads ? Array.from(navigator.getGamepads()).some(Boolean) : false;
      setGamepadConnected(stillConnected);
      if (!stillConnected) onGamepadDisconnect && onGamepadDisconnect(e.gamepad || null);
    };
    window.addEventListener('gamepadconnected', onConnect);
    window.addEventListener('gamepaddisconnected', onDisconnect);
    return () => {
      window.removeEventListener('gamepadconnected', onConnect);
      window.removeEventListener('gamepaddisconnected', onDisconnect);
    };
  }, [onGamepadConnect, onGamepadDisconnect]);

  // Gamepad polling loop — movement + button activation. Connect/disconnect
  // itself is handled above, not here.
  useEffect(() => {
    if (disabled) return;
    let rafId;

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
        const axisY = pad.axes[1] || 0;
        const dpadLeft = pad.buttons[14]?.pressed;
        const dpadRight = pad.buttons[15]?.pressed;
        const dpadUp = pad.buttons[12]?.pressed;
        const dpadDown = pad.buttons[13]?.pressed;

        let hDir = null;
        if (dpadLeft || axisX < -STICK_DEADZONE) hDir = 'left';
        else if (dpadRight || axisX > STICK_DEADZONE) hDir = 'right';

        let vDir = null;
        if (dpadUp || axisY < -STICK_DEADZONE) vDir = 'up';
        else if (dpadDown || axisY > STICK_DEADZONE) vDir = 'down';

        const now = performance.now();
        const s = stateRef.current;

        if (hDir) {
          setInputMethod(detectPadType(pad.id));
          if (hDir !== s.lastDir) {
            moveHorizontal(hDir);
            s.lastDir = hDir;
            s.lastMoveTime = now;
          } else {
            const sinceLast = now - s.lastMoveTime;
            if (sinceLast > REPEAT_DELAY_MS && (sinceLast - REPEAT_DELAY_MS) % REPEAT_RATE_MS < 16) {
              moveHorizontal(hDir);
            }
          }
        } else {
          s.lastDir = null;
        }

        // Vertical is deliberately a single discrete step per press (no
        // auto-repeat) — holding up/down shouldn't rocket through zones.
        if (vDir) {
          if (vDir !== s.lastVertDir) {
            setInputMethod(detectPadType(pad.id));
            moveVertical(vDir);
            s.lastVertDir = vDir;
          }
        } else {
          s.lastVertDir = null;
        }

        // 0 = A/Cross, 1 = B/Circle, 2 = X/Square, 3 = Y/Triangle
        const aPressed = pad.buttons[0]?.pressed;
        const bPressed = pad.buttons[1]?.pressed;
        const xPressed = pad.buttons[2]?.pressed;
        const yPressed = pad.buttons[3]?.pressed;

        if (aPressed && !s.prevButtons[0]) {
          setInputMethod(detectPadType(pad.id));
          rumble(pad, { duration: 140, weakMagnitude: 0.3, strongMagnitude: 0.7 });
          activate();
        }
        if (bPressed && !s.prevButtons[1]) {
          setInputMethod(detectPadType(pad.id));
          if (zoneRef.current === 'grid') {
            rumble(pad, { duration: 90, weakMagnitude: 0.2, strongMagnitude: 0.3 });
            onGridRemove && onGridRemove(gridIndexRef.current);
          } else {
            // B backs out of header/filters to the shelf, same as a TV UI's "back".
            rumble(pad, { duration: 40, weakMagnitude: 0.15, strongMagnitude: 0.1 });
            setZone('grid');
          }
        }
        if (xPressed && !s.prevButtons[2]) {
          setInputMethod(detectPadType(pad.id));
          if (zoneRef.current === 'grid') {
            rumble(pad, { duration: 70, weakMagnitude: 0.15, strongMagnitude: 0.25 });
            onGridSecondary && onGridSecondary(gridIndexRef.current);
          }
        }
        if (yPressed && !s.prevButtons[3]) {
          setInputMethod(detectPadType(pad.id));
          if (zoneRef.current === 'grid') onGridTertiary && onGridTertiary(gridIndexRef.current);
        }
        s.prevButtons = { 0: aPressed, 1: bPressed, 2: xPressed, 3: yPressed };
      }

      rafId = requestAnimationFrame(poll);
    };

    rafId = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(rafId);
  }, [disabled, moveHorizontal, moveVertical, activate, onGridSecondary, onGridTertiary, onGridRemove]);

  return {
    zone,
    setZone,
    gridIndex,
    setGridIndex,
    headerIndex,
    filterIndex,
    focusHover,
    inputMethod,
    gamepadConnected,
  };
}
