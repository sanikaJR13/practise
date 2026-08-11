/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        background: 'var(--color-background)',
        surface: 'var(--color-surface)',
        'surface-dim': 'var(--color-surface-dim)',
        'surface-bright': 'var(--color-surface-bright)',
        'surface-container-lowest': 'var(--color-surface-container-lowest)',
        'surface-container-low': 'var(--color-surface-container-low)',
        'surface-container': 'var(--color-surface-container)',
        'surface-container-high': 'var(--color-surface-container-high)',
        'surface-container-highest': 'var(--color-surface-container-highest)',
        'surface-variant': 'var(--color-surface-variant)',
        primary: 'var(--color-primary)',
        'primary-container': 'var(--color-primary-container)',
        'primary-fixed': 'var(--color-primary-fixed)',
        'primary-fixed-dim': 'var(--color-primary-fixed-dim)',
        secondary: 'var(--color-secondary)',
        'secondary-container': 'var(--color-secondary-container)',
        tertiary: 'var(--color-tertiary)',
        'tertiary-container': 'var(--color-tertiary-container)',
        'tertiary-fixed': 'var(--color-tertiary-fixed)',
        'tertiary-fixed-dim': 'var(--color-tertiary-fixed-dim)',
        error: 'var(--color-error)',
        'error-container': 'var(--color-error-container)',
        outline: 'var(--color-outline)',
        'outline-variant': 'var(--color-outline-variant)',
        'inverse-surface': 'var(--color-inverse-surface)',
        'inverse-on-surface': 'var(--color-inverse-on-surface)',
        'inverse-primary': 'var(--color-inverse-primary)',
        'surface-tint': 'var(--color-surface-tint)',
        'on-background': 'var(--color-on-background)',
        'on-surface': 'var(--color-on-surface)',
        'on-surface-variant': 'var(--color-on-surface-variant)',
        'on-primary': 'var(--color-on-primary)',
        'on-primary-container': 'var(--color-on-primary-container)',
        'on-primary-fixed': 'var(--color-on-primary-fixed)',
        'on-primary-fixed-variant': 'var(--color-on-primary-fixed-variant)',
        'on-secondary': 'var(--color-on-secondary)',
        'on-secondary-container': 'var(--color-on-secondary-container)',
        'on-tertiary': 'var(--color-on-tertiary)',
        'on-tertiary-container': 'var(--color-on-tertiary-container)',
        'on-tertiary-fixed': 'var(--color-on-tertiary-fixed)',
        'on-tertiary-fixed-variant': 'var(--color-on-tertiary-fixed-variant)',
        'on-error': 'var(--color-on-error)',
        'on-error-container': 'var(--color-on-error-container)'
      },
      borderRadius: {
        lg: '0.25rem',
        xl: '0.5rem',
        '2xl': '1rem',
        '3xl': '1.5rem'
      },
      fontFamily: {
        headline: ['Manrope', 'sans-serif'],
        document: ['"EB Garamond"', 'serif'],
        body: ['Inter', 'sans-serif'],
        label: ['Inter', 'sans-serif']
      },
      boxShadow: {
        ambient: '0 12px 32px rgba(25, 28, 30, 0.06)',
        float: '0 24px 50px rgba(3, 22, 50, 0.12)'
      },
      backgroundImage: {
        grid: 'radial-gradient(circle at 1px 1px, rgba(117, 119, 126, 0.12) 1px, transparent 0)'
      }
    }
  },
  plugins: []
};
