import React, { useMemo, useRef } from 'react';
import { useModalNav } from '../hooks/useModalNav.js';
import { rumble, REMAPPABLE_BUTTONS, BUTTON_GLYPHS } from '../utils/gamepad.js';
import { FONT_OPTIONS } from '../utils/fonts.js';

const TABS = [
  { id: 'startup', label: 'Startup' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'controller', label: 'Controller' },
  { id: 'vibration', label: 'Vibration' },
];

const ACTION_LABELS = {
  activate: 'Launch',
  secondary: 'Favorite',
  tertiary: 'Set artwork',
  back: 'Remove / Back',
};
const ACTION_ORDER = ['activate', 'secondary', 'tertiary', 'back'];

function clampStep(value, delta, min, max, step) {
  const next = Math.round((value + delta * step) * 100) / 100;
  return Math.max(min, Math.min(max, next));
}

// A single settings row rendered generically enough to be driven by mouse,
// keyboard, or a controller: 'tabs' and 'select' rows cycle their value with
// left/right, 'slider' rows nudge by a step, 'toggle' flips a checkbox, and
// 'button' just activates. useModalNav (vertical) moves focus between rows
// and fires A/Enter as `onActivate`; a companion left/right listener below
// handles adjusting whichever row is currently focused.
function Row({ row, focused }) {
  const base = 'rounded-lg -mx-2 px-3 py-2.5 transition-colors';
  const focusedCls = focused ? 'ring-2 ring-accent bg-void/40' : '';

  if (row.type === 'tabs') {
    return (
      <div className={[base, focusedCls, 'flex items-center gap-1'].join(' ')}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => row.onSelect(t.id)}
            className={[
              'flex-1 text-sm font-body font-semibold px-3 py-2 rounded-md transition-colors',
              t.id === row.value ? 'bg-accent text-black' : 'text-muted hover:text-ink',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>
    );
  }

  if (row.type === 'toggle') {
    return (
      <label className={[base, focusedCls, 'flex items-start gap-3 cursor-pointer block'].join(' ')}>
        <input
          type="checkbox"
          checked={!!row.value}
          onChange={(e) => row.onChange(e.target.checked)}
          className="mt-1 w-4 h-4 accent-accent flex-shrink-0"
        />
        <span className="font-body text-sm text-muted">{row.label}</span>
      </label>
    );
  }

  if (row.type === 'select') {
    return (
      <div className={[base, focusedCls, 'flex items-center justify-between gap-4'].join(' ')}>
        <span className="font-body text-sm text-ink">{row.label}</span>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button type="button" onClick={() => row.onAdjust(-1)} className="w-7 h-7 rounded-full bg-panel border border-white/10 text-muted hover:text-ink hover:border-accent flex items-center justify-center">‹</button>
          <select
            value={row.value}
            onChange={(e) => row.onChangeRaw(e.target.value)}
            className="font-body text-sm bg-panel border border-white/10 rounded-md px-2 py-1.5 min-w-32 text-center text-ink"
          >
            {row.options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button type="button" onClick={() => row.onAdjust(1)} className="w-7 h-7 rounded-full bg-panel border border-white/10 text-muted hover:text-ink hover:border-accent flex items-center justify-center">›</button>
        </div>
      </div>
    );
  }

  if (row.type === 'slider') {
    return (
      <div className={[base, focusedCls].join(' ')}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-body text-sm text-ink">{row.label}</span>
          <span className="font-mono text-xs text-muted">{Math.round((row.value / row.max) * 100)}%</span>
        </div>
        <input
          type="range"
          min={row.min}
          max={row.max}
          step={row.step}
          value={row.value}
          onChange={(e) => row.onChange(parseFloat(e.target.value))}
          className="w-full accent-accent"
        />
      </div>
    );
  }

  // button
  return (
    <button
      type="button"
      onClick={row.onActivate}
      className={[
        base,
        focusedCls,
        'w-full text-left font-body text-sm font-semibold',
        row.destructive ? 'text-red-300 hover:text-red-200' : 'text-accent hover:text-accent-soft',
      ].join(' ')}
    >
      {row.label}
    </button>
  );
}

export default function SettingsPanel({
  autoLaunch,
  onToggleAutoLaunch,
  onClose,
  onQuit,
  onControllerInput,
  prefs,
  onUpdatePrefs,
  inputMethod,
}) {
  const [activeTab, setActiveTab] = React.useState('startup');
  const latestPadRef = useRef(null);
  const padType = inputMethod === 'playstation' ? 'playstation' : 'xbox';

  const setControllerMap = (action, buttonIndex) => {
    const current = prefs.controllerMap;
    // Swap rather than double-bind: if some other action already owns this
    // button, it takes over whatever `action` used to point at, so every
    // action always maps to exactly one button.
    const collidingAction = ACTION_ORDER.find((a) => a !== action && current[a] === buttonIndex);
    const next = { ...current, [action]: buttonIndex };
    if (collidingAction) next[collidingAction] = current[action];
    onUpdatePrefs({ controllerMap: next });
  };

  const setVibration = (partial) => {
    onUpdatePrefs({ vibration: { ...prefs.vibration, ...partial } });
  };

  const testRumble = () => {
    rumble(latestPadRef.current, { duration: 220, weakMagnitude: 0.7, strongMagnitude: 0.9 });
  };

  // Build the flat, focusable row list for whichever tab is active. Row 0
  // is always the tab switcher itself, so up/down naturally reaches it too.
  const rows = useMemo(() => {
    const list = [
      { type: 'tabs', value: activeTab, onSelect: setActiveTab },
    ];

    if (activeTab === 'startup') {
      list.push({
        type: 'toggle',
        label: 'Launch fullscreen on Windows startup — boots straight into Big Picture, no clicking required.',
        value: autoLaunch,
        onChange: onToggleAutoLaunch,
      });
    }

    if (activeTab === 'appearance') {
      const idx = FONT_OPTIONS.findIndex((f) => f.id === prefs.font);
      list.push({
        type: 'select',
        label: 'Font',
        value: prefs.font,
        options: FONT_OPTIONS.map((f) => ({ value: f.id, label: f.label })),
        onChangeRaw: (v) => onUpdatePrefs({ font: v }),
        onAdjust: (dir) => {
          const nextIdx = Math.max(0, Math.min(FONT_OPTIONS.length - 1, idx + dir));
          onUpdatePrefs({ font: FONT_OPTIONS[nextIdx].id });
        },
      });
    }

    if (activeTab === 'controller') {
      ACTION_ORDER.forEach((action) => {
        const value = prefs.controllerMap[action];
        const idx = REMAPPABLE_BUTTONS.indexOf(value);
        list.push({
          type: 'select',
          label: ACTION_LABELS[action],
          value,
          options: REMAPPABLE_BUTTONS.map((b) => ({ value: b, label: BUTTON_GLYPHS[padType][b] })),
          onChangeRaw: (v) => setControllerMap(action, Number(v)),
          onAdjust: (dir) => {
            const nextIdx = Math.max(0, Math.min(REMAPPABLE_BUTTONS.length - 1, idx + dir));
            setControllerMap(action, REMAPPABLE_BUTTONS[nextIdx]);
          },
        });
      });
    }

    if (activeTab === 'vibration') {
      list.push({
        type: 'toggle',
        label: 'Enable controller vibration',
        value: prefs.vibration.enabled,
        onChange: (v) => setVibration({ enabled: v }),
      });
      list.push({
        type: 'slider',
        label: 'Left motor — low rumble',
        value: prefs.vibration.weakMagnitude,
        min: 0,
        max: 1.5,
        step: 0.1,
        onChange: (v) => setVibration({ weakMagnitude: v }),
      });
      list.push({
        type: 'slider',
        label: 'Right motor — sharp rumble',
        value: prefs.vibration.strongMagnitude,
        min: 0,
        max: 1.5,
        step: 0.1,
        onChange: (v) => setVibration({ strongMagnitude: v }),
      });
      list.push({ type: 'button', label: 'Test vibration', onActivate: testRumble });
    }

    list.push({ type: 'button', label: 'Quit app', destructive: true, onActivate: onQuit });
    list.push({ type: 'button', label: 'Done', onActivate: onClose });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, autoLaunch, prefs, padType]);

  const [index] = useModalNav({
    itemCount: rows.length,
    orientation: 'vertical',
    initialIndex: 0,
    onActivate: (i) => {
      const row = rows[i];
      if (row.type === 'toggle') row.onChange(!row.value);
      else if (row.type === 'button') row.onActivate();
      // tabs/select/slider rows are adjusted with left/right, not A — see below.
    },
    onCancel: onClose,
    onControllerInput: (pad) => {
      latestPadRef.current = pad;
      onControllerInput && onControllerInput(pad);
    },
  });

  // Left/right adjusts whichever row is focused (tabs, dropdown, or
  // slider). Vertical mode's own arrow handling only listens for
  // up/down, so left/right is free to repurpose here without conflicting.
  React.useEffect(() => {
    const adjust = (dir) => {
      const row = rows[index];
      if (!row) return;
      if (row.type === 'tabs') {
        const i = TABS.findIndex((t) => t.id === row.value);
        const next = TABS[Math.max(0, Math.min(TABS.length - 1, i + dir))];
        row.onSelect(next.id);
      } else if (row.type === 'select') {
        row.onAdjust(dir);
      } else if (row.type === 'slider') {
        row.onChange(clampStep(row.value, dir, row.min, row.max, row.step));
      }
    };

    const onKeyDown = (e) => {
      if (e.key === 'ArrowLeft') { adjust(-1); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { adjust(1); e.preventDefault(); }
    };
    window.addEventListener('keydown', onKeyDown);

    let rafId;
    const state = { lastDir: null };
    const poll = () => {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      const pad = Array.from(pads).find(Boolean);
      if (pad) {
        const axis = pad.axes[0] || 0;
        const left = pad.buttons[14]?.pressed || axis < -0.5;
        const right = pad.buttons[15]?.pressed || axis > 0.5;
        const dir = left ? -1 : right ? 1 : null;
        if (dir !== state.lastDir) {
          if (dir) adjust(dir);
          state.lastDir = dir;
        }
      }
      rafId = requestAnimationFrame(poll);
    };
    rafId = requestAnimationFrame(poll);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      cancelAnimationFrame(rafId);
    };
  }, [rows, index]);

  return (
    <div className="absolute inset-0 z-30 flex items-start justify-end p-6 bg-black/40" onClick={onClose}>
      <div
        className="w-[26rem] max-h-[calc(100vh-3rem)] overflow-y-auto rounded-xl bg-panel-raised border border-white/10 p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-lg font-bold text-ink mb-1">Settings</h3>
        <p className="font-body text-sm text-muted mb-4">
          Box art is fetched automatically through GFN Launcher's own artwork service — no API key needed.
        </p>

        <div className="space-y-1">
          {rows.map((row, i) => (
            <Row key={i} row={row} focused={index === i} />
          ))}
        </div>

        <p className="font-body text-[11px] text-muted mt-4 text-center">
          ↑/↓ choose row · ←/→ change value · A/Enter select · B/Esc close
        </p>
      </div>
    </div>
  );
}
