/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        vibrancy: {
          deep: '#121316',
          mid: '#1c1d22',
          surface: '#282a32',
          accent: '#3b82f6',
          green: '#22c55e',
          orange: '#f59e0b',
          red: '#ef4444',
        },
      },
      fontFamily: {
        serif: ['Georgia', 'Times New Roman', 'serif'],
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['SF Mono', 'Menlo', 'JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}

