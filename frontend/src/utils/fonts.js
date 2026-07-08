// Font presets selectable from Settings → Appearance. Every family listed
// here is preloaded via the Google Fonts <link> in index.html, so swapping
// the active preset is just three CSS custom property writes — no network
// request, no flash of the wrong font.
export const FONT_OPTIONS = [
  {
    id: 'default',
    label: 'Rajdhani',
    blurb: 'The original look — sharp, technical, GFN-style.',
    display: '"Rajdhani", sans-serif',
    body: '"Inter", sans-serif',
    mono: '"JetBrains Mono", monospace',
  },
  {
    id: 'sci-fi',
    label: 'Orbitron',
    blurb: 'Wide, geometric, a little more sci-fi console.',
    display: '"Orbitron", sans-serif',
    body: '"Rubik", sans-serif',
    mono: '"JetBrains Mono", monospace',
  },
  {
    id: 'modern',
    label: 'Space Grotesk',
    blurb: 'Clean and contemporary, softer than the default.',
    display: '"Space Grotesk", sans-serif',
    body: '"Manrope", sans-serif',
    mono: '"JetBrains Mono", monospace',
  },
  {
    id: 'technical',
    label: 'Chakra Petch',
    blurb: 'Uniform monospaced-feel headings and body text.',
    display: '"Chakra Petch", sans-serif',
    body: '"Chakra Petch", sans-serif',
    mono: '"JetBrains Mono", monospace',
  },
  {
    id: 'retro',
    label: 'Press Start',
    blurb: 'Pixel-arcade titles, for a retro cabinet feel.',
    display: '"Press Start 2P", cursive',
    body: '"VT323", monospace',
    mono: '"VT323", monospace',
  },
];

export function getFontOption(id) {
  return FONT_OPTIONS.find((f) => f.id === id) || FONT_OPTIONS[0];
}

// Writes the chosen preset's three families onto :root as CSS custom
// properties. tailwind.config.js points font-display/font-body/font-mono at
// these variables, so every existing `font-display`/`font-body`/`font-mono`
// class in the app picks up the change immediately, with no re-render.
export function applyFont(id) {
  const option = getFontOption(id);
  const root = document.documentElement.style;
  root.setProperty('--font-display', option.display);
  root.setProperty('--font-body', option.body);
  root.setProperty('--font-mono', option.mono);
}
