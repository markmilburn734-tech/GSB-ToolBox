/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'brand': '#573960',
        'brand2': '#573960',
        'brand3': '#ff3154',
        'brand4': '#ff3154',
        'brand5': '#ff3154',
        'brand6': '#816a88',
        'brand-tint': '#f4f1f5',   // very light purple wash for surfaces
      },
      fontFamily: {
        // Clean, Arial-esque native stack — nicer than Arial, no web-font load.
        sans: ['"Segoe UI"', 'system-ui', '-apple-system', 'Roboto', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        // Refined monospace for codes/figures — leads with Cascadia (Win 11), then Consolas.
        mono: ['"Cascadia Code"', '"Cascadia Mono"', 'Consolas', 'ui-monospace', 'Menlo', 'monospace'],
      },
      // Squared-off corners: crisp, premium feel (pills keep rounded-full).
      borderRadius: {
        none: '0',
        sm: '0.125rem',
        DEFAULT: '0.1875rem',
        md: '0.25rem',
        lg: '0.25rem',
        xl: '0.3125rem',
        '2xl': '0.375rem',
        '3xl': '0.5rem',
        full: '9999px',
      },
      boxShadow: {
        brand: '0 10px 30px -12px rgba(87, 57, 96, 0.35)',
      },
    },
  },
  plugins: [],
}