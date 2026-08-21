/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary, #031632)',
        secondary: 'var(--color-secondary, #2563eb)',
        background: 'var(--color-background, #f8fafc)',
        surface: 'var(--color-surface, #ffffff)',
        'surface-container-low': 'var(--color-surface-container-low, #f1f5f9)',
        'surface-container-lowest': 'var(--color-surface-container-lowest, #ffffff)',
        'surface-container-high': 'var(--color-surface-container-high, #e2e8f0)',
        'on-surface': 'var(--color-on-surface, #0f172a)',
        'on-surface-variant': 'var(--color-on-surface-variant, #475569)',
        'outline-variant': 'var(--color-outline-variant, #cbd5e1)',
        error: 'var(--color-error, #ef4444)',
      },
    },
  },
  plugins: [],
}
