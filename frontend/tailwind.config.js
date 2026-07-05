/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        void: '#0A0C10',
        panel: '#14171D',
        'panel-raised': '#1C2029',
        accent: '#76B900',
        'accent-soft': '#9FE050',
        glow: '#E8FFFA',
        ink: '#F2F4F2',
        muted: '#8A9099',
      },
      fontFamily: {
        display: ['"Rajdhani"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        focus: '0 0 0 3px #76B900, 0 0 30px 4px rgba(118,185,0,0.45)',
      },
    },
  },
  plugins: [],
};
