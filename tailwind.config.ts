import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { 50: '#eef6ff', 100: '#d9eaff', 200: '#bcdaff', 300: '#8ec3ff', 400: '#59a2ff', 500: '#3380fa', 600: '#1d62ef', 700: '#154ddc', 800: '#183fb2', 900: '#19388c' },
        sun: { 50: '#fffbeb', 100: '#fef3c7', 400: '#fbbf24', 500: '#f59e0b' },
      },
      fontFamily: { sans: ['ui-rounded', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'] },
    },
  },
  plugins: [],
};
export default config;
