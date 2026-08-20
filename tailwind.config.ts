import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0B0C0E',
        surface: '#15171B',
        elev: '#1D2025',
        line: '#2A2D33',
        brand: '#FF5E1A',
        data: '#2DB4FF',
        ink: '#F3F4F5',
        muted: '#9BA1AA',
        ok: '#3AC96E',
        warn: '#F5B942',
        bad: '#FF5468'
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace']
      },
      borderRadius: { card: '8px', chip: '2px' },
      keyframes: {
        rise: { '0%': { opacity: '0', transform: 'translateY(12px)' }, '100%': { opacity: '1', transform: 'none' } }
      },
      animation: { rise: 'rise .5s cubic-bezier(.22,1,.36,1) both' }
    }
  },
  plugins: []
} satisfies Config;
