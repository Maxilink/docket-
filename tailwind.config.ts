import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#0B2632', 700: '#123847', 600: '#1A4A5C', 100: '#E3ECEF' },
        accent: { DEFAULT: '#49AB9B', ink: '#2D7A6E', soft: '#E1F2EF' },
        canvas: '#F4F7F7',
        line: '#D6DFE0',
        muted: '#56686D',
        ink: '#0F1E24',
        hearing: { DEFAULT: '#9B2C3A', soft: '#F7E4E6' },
        filing: { DEFAULT: '#7A5A0E', soft: '#F8ECD6' },
        client: { DEFAULT: '#2D7A6E', soft: '#E1F2EF' },
        internal: { DEFAULT: '#4D5E7A', soft: '#E6EAF1' },
        warn: { DEFAULT: '#8A3B0E', soft: '#FDF1E4', line: '#E8B98A' },
      },
      fontFamily: {
        display: ['"Libre Caslon Text"', 'Georgia', 'serif'],
        sans: ['"IBM Plex Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
export default config;
