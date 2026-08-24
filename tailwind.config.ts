import type { Config } from 'tailwindcss';

/**
 * Euro Fantasy Lab — dizajn tokeni.
 *
 * Brend: narandžasta #DF6320, crna #000000, bela #FFFFFF.
 * Proizvod je taman: površine su izvedene iz crne, narandžasta je
 * isključivo akcija/naglasak. Nema drugih brend boja.
 */
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        /* površine — sve izvedeno iz crne */
        black: '#000000',
        bg: '#08090B',
        sunken: '#050608',
        surface: '#101215',
        elev: '#171A1E',
        raise: '#1E2227',

        /* linije */
        line: '#23262B',
        'line-2': '#31353C',
        hair: 'rgba(255,255,255,0.07)',

        /* brend */
        brand: {
          DEFAULT: '#DF6320',
          400: '#EE7C3D',
          500: '#DF6320',
          600: '#C4531A',
          700: '#9E4213',
          ink: '#0A0603'
        },

        /* tipografija */
        ink: '#FFFFFF',
        'ink-2': '#C9CDD3',
        'ink-3': '#969CA6',
        /* Najtisi ton koji jos prolazi WCAG AA (4.5:1) na crnoj podlozi.
           Ispod ovoga se ne ide — sitne sive oznake moraju da se citaju. */
        'ink-4': '#7D838D',

        /* semantika — ostaje u toploj porodici, nikad sama ne nosi značenje */
        pos: '#DF6320',
        neg: '#D24B3C',
        warn: '#E0A62A',
        ok: '#4BA96B'
      },

      fontFamily: {
        display: ['var(--font-display)', 'Proxima Nova', 'Barlow Condensed', 'Impact', 'sans-serif'],
        sans: ['var(--font-sans)', 'Proxima Nova', 'Barlow', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace']
      },

      fontSize: {
        label: ['10px', { lineHeight: '1', letterSpacing: '0.14em' }],
        micro: ['11px', { lineHeight: '1.35' }],
        small: ['13px', { lineHeight: '1.5' }],
        body: ['15px', { lineHeight: '1.6' }],
        lead: ['17px', { lineHeight: '1.6' }]
      },

      borderRadius: { xs: '2px', sm: '4px', md: '6px', lg: '10px', xl: '16px' },

      maxWidth: { page: '1240px', prose: '62ch' },

      boxShadow: {
        pop: '0 24px 60px -24px rgba(0,0,0,.85)',
        rail: '0 -8px 32px -12px rgba(0,0,0,.9)',
        focus: '0 0 0 2px #08090B, 0 0 0 4px #DF6320'
      },

      transitionTimingFunction: { out: 'cubic-bezier(.2,.8,.2,1)' },
      transitionDuration: { fast: '120ms', DEFAULT: '180ms', slow: '240ms' },

      keyframes: {
        rise: { '0%': { opacity: '0', transform: 'translateY(10px)' }, '100%': { opacity: '1', transform: 'none' } },
        fade: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        tickUp: { '0%': { opacity: '0', transform: 'translateY(60%)' }, '100%': { opacity: '1', transform: 'none' } },
        grow: { '0%': { transform: 'scaleX(0)' }, '100%': { transform: 'scaleX(1)' } }
      },
      animation: {
        rise: 'rise .38s cubic-bezier(.2,.8,.2,1) both',
        fade: 'fade .24s ease-out both',
        shimmer: 'shimmer 1.4s linear infinite',
        tickUp: 'tickUp .34s cubic-bezier(.2,.8,.2,1) both',
        grow: 'grow .5s cubic-bezier(.2,.8,.2,1) both'
      }
    }
  },
  plugins: []
} satisfies Config;
