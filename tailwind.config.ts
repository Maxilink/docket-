import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#2E1A5C', 700: '#3A2470', 600: '#4A3388', 100: '#EFEBF7' },
        accent: { DEFAULT: '#49AB9B', ink: '#2D7A6E', soft: '#E1F2EF' },
        canvas: '#F7F6FA',
        line: '#E6E3EE',
        muted: '#625C75',
        ink: '#24154A',
        hearing: { DEFAULT: '#A12D44', soft: '#FBEAED' },
        filing: { DEFAULT: '#8A6410', soft: '#FAF0DB' },
        client: { DEFAULT: '#2D7A6E', soft: '#E1F2EF' },
        internal: { DEFAULT: '#50637A', soft: '#EBEFF4' },
        warn: { DEFAULT: '#8A4B0E', soft: '#FDF4E6', line: '#F1D4AE' },
      },
      fontFamily: {
        display: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
export default config;
