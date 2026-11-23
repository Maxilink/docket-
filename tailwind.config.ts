import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // From the C-Diary logo: deep purple, violet and cyan.
        primary: { DEFAULT: '#2E0562', 800: '#22044A', 700: '#3D0A80', 600: '#4F05AD', 500: '#6A2FD0', 400: '#8F63E0', 200: '#DCCDF3', 100: '#F0EAF9', 50: '#F8F4FD' },
        // Bright cyan for fills; the darker ink version for small text so it stays readable on white.
        accent: { DEFAULT: '#0ECED4', ink: '#0A7178', soft: '#E0F8F9', 300: '#6BE3E7' },
        canvas: '#F7F6FA',
        line: '#E6E3EE',
        muted: '#625C75',
        ink: '#1F0F45',
        hearing: { DEFAULT: '#A12D44', soft: '#FBEAED' },
        filing: { DEFAULT: '#8A6410', soft: '#FAF0DB' },
        client: { DEFAULT: '#0A7178', soft: '#E0F8F9' },
        internal: { DEFAULT: '#50637A', soft: '#EBEFF4' },
        warn: { DEFAULT: '#8A4B0E', soft: '#FDF4E6', line: '#F1D4AE' },
      },
      boxShadow: {
        lift: '0 10px 30px -12px rgba(46, 5, 98, 0.30)',
        glow: '0 8px 24px -8px rgba(14, 206, 212, 0.55)',
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
