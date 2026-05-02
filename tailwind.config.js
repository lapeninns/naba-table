const { fontFamily } = require('tailwindcss/defaultTheme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: ['class'],
  theme: {
    extend: {
      // =======================================================================
      // COLOR SYSTEM
      // Using HSL with alpha support: hsl(var(--token) / <alpha-value>)
      // This enables utilities like bg-primary/50, text-muted-foreground/80
      // =======================================================================
      colors: {
        // Core Semantic Colors
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',

        card: {
          DEFAULT: 'hsl(var(--card) / <alpha-value>)',
          foreground: 'hsl(var(--card-foreground) / <alpha-value>)',
        },

        popover: {
          DEFAULT: 'hsl(var(--popover) / <alpha-value>)',
          foreground: 'hsl(var(--popover-foreground) / <alpha-value>)',
        },

        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
        },

        secondary: {
          DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
          foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)',
        },

        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)',
        },

        accent: {
          DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
          foreground: 'hsl(var(--accent-foreground) / <alpha-value>)',
        },

        // Semantic Status Colors
        destructive: {
          DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
          foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)',
        },

        success: {
          DEFAULT: 'hsl(var(--success) / <alpha-value>)',
          foreground: 'hsl(var(--success-foreground) / <alpha-value>)',
        },

        warning: {
          DEFAULT: 'hsl(var(--warning) / <alpha-value>)',
          foreground: 'hsl(var(--warning-foreground) / <alpha-value>)',
        },

        info: {
          DEFAULT: 'hsl(var(--info) / <alpha-value>)',
          foreground: 'hsl(var(--info-foreground) / <alpha-value>)',
        },

        // Utility Colors
        border: 'hsl(var(--border) / <alpha-value>)',
        input: 'hsl(var(--input) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',
        overlay: 'hsl(var(--overlay) / <alpha-value>)',

        // Chart Colors (for data visualization)
        chart: {
          1: 'hsl(var(--chart-1) / <alpha-value>)',
          2: 'hsl(var(--chart-2) / <alpha-value>)',
          3: 'hsl(var(--chart-3) / <alpha-value>)',
          4: 'hsl(var(--chart-4) / <alpha-value>)',
          5: 'hsl(var(--chart-5) / <alpha-value>)',
        },

        // Sidebar Colors
        sidebar: {
          DEFAULT: 'var(--sidebar)',
          foreground: 'var(--sidebar-foreground)',
          primary: 'var(--sidebar-primary)',
          'primary-foreground': 'var(--sidebar-primary-foreground)',
          accent: 'var(--sidebar-accent)',
          'accent-foreground': 'var(--sidebar-accent-foreground)',
          border: 'var(--sidebar-border)',
          ring: 'var(--sidebar-ring)',
        },

        // Neutral Scale (for fine-grained control)
        neutral: {
          0: 'var(--color-neutral-0)',
          50: 'var(--color-neutral-50)',
          100: 'var(--color-neutral-100)',
          200: 'var(--color-neutral-200)',
          300: 'var(--color-neutral-300)',
          400: 'var(--color-neutral-400)',
          500: 'var(--color-neutral-500)',
          600: 'var(--color-neutral-600)',
          700: 'var(--color-neutral-700)',
          800: 'var(--color-neutral-800)',
          900: 'var(--color-neutral-900)',
        },

        // Legacy SR Tokens (deprecation path)
        'sr-primary': 'var(--color-primary)',
        'sr-primary-pressed': 'var(--color-primary-pressed)',
        'sr-accent': 'var(--color-accent)',
        'sr-text-primary': 'var(--color-text-primary)',
        'sr-text-secondary': 'var(--color-text-secondary)',
        'sr-on-primary': 'var(--color-on-primary)',
        'sr-surface': 'var(--color-surface)',
        'sr-background': 'var(--color-background)',
        'sr-border': 'var(--color-border)',
      },

      // =======================================================================
      // TYPOGRAPHY
      // Radix Luma aliases for shared app, guest, and public surfaces.
      // =======================================================================
      fontFamily: {
        sans: ['var(--font-sajilo)', ...fontFamily.sans],
      },

      fontSize: {
        'screen-title': [
          'var(--pg-text-section)',
          { lineHeight: 'var(--pg-leading-snug)', fontWeight: '700', letterSpacing: '0' },
        ],
        'section-header': ['1.5rem', { lineHeight: '2rem', fontWeight: '700', letterSpacing: '0' }],
        'card-title': ['1.25rem', { lineHeight: '1.75rem', fontWeight: '600' }],
        body: ['var(--pg-text-body)', { lineHeight: 'var(--pg-leading-body)', fontWeight: '400' }],
        label: ['0.875rem', { lineHeight: '1.25rem', fontWeight: '500' }],
        button: ['0.875rem', { lineHeight: '1.25rem', fontWeight: '600', letterSpacing: '0.01em' }],

        // Guest Typography Scale (fluid with clamp)
        'guest-hero': [
          'var(--guest-text-hero)',
          {
            lineHeight: 'var(--guest-leading-tight)',
            fontWeight: '700',
            letterSpacing: '-0.025em',
          },
        ],
        'guest-hero-lg': [
          'var(--guest-text-hero-lg)',
          {
            lineHeight: 'var(--guest-leading-tight)',
            fontWeight: '700',
            letterSpacing: '-0.025em',
          },
        ],
        'guest-page': [
          'var(--guest-text-page)',
          { lineHeight: 'var(--guest-leading-tight)', fontWeight: '700', letterSpacing: '-0.02em' },
        ],
        'guest-section': [
          'var(--guest-text-section)',
          { lineHeight: 'var(--guest-leading-snug)', fontWeight: '600', letterSpacing: '-0.015em' },
        ],
        'guest-card': [
          'var(--guest-text-card)',
          { lineHeight: 'var(--guest-leading-snug)', fontWeight: '600' },
        ],
        'guest-body': ['var(--guest-text-body)', { lineHeight: 'var(--guest-leading-normal)' }],
        'guest-caption': [
          'var(--guest-text-caption)',
          { lineHeight: 'var(--guest-leading-normal)' },
        ],
        'guest-micro': [
          'var(--guest-text-micro)',
          { lineHeight: 'var(--guest-leading-normal)', fontWeight: '500' },
        ],
      },

      // =======================================================================
      // SPACING
      // Shared Radix Luma spacing aliases.
      // =======================================================================
      spacing: {
        'safe-b': 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)',
        'safe-t': 'env(safe-area-inset-top, 0px)',
        'safe-l': 'env(safe-area-inset-left, 0px)',
        'safe-r': 'env(safe-area-inset-right, 0px)',

        // Named spacing tokens
        'screen-margin': 'var(--screen-margin, 1.5rem)',
        'card-padding': 'var(--card-padding, 1.5rem)',
        'button-height': 'var(--button-height, 2.25rem)',
        'touch-target': 'var(--touch-target, 2.75rem)',

        // Guest spacing scale
        'guest-xs': 'var(--guest-space-xs)',
        'guest-sm': 'var(--guest-space-sm)',
        'guest-md': 'var(--guest-space-md)',
        'guest-lg': 'var(--guest-space-lg)',
        'guest-xl': 'var(--guest-space-xl)',
        'guest-2xl': 'var(--guest-space-2xl)',
        'guest-3xl': 'var(--guest-space-3xl)',
      },

      // =======================================================================
      // BORDER RADIUS
      // Shared Radix Luma radius tokens.
      // =======================================================================
      borderRadius: {
        // Base radius scale (uses CSS variable for consistency)
        sm: 'var(--radius-sm)',
        DEFAULT: 'var(--radius)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--pg-radius-xl)',
        '3xl': '1.925rem',
        '4xl': '2.275rem',
        pill: 'var(--radius-pill)',

        // Guest radius tokens
        'guest-sm': 'var(--guest-radius-sm)',
        'guest-md': 'var(--guest-radius-md)',
        'guest-lg': 'var(--guest-radius-lg)',
        'guest-xl': 'var(--guest-radius-xl)',
        'guest-2xl': 'var(--guest-radius-2xl)',
        'guest-full': 'var(--guest-radius-full)',

        // Legacy SR tokens (deprecation path)
        'sr-sm': 'var(--radius-sm)',
        'sr-base': 'var(--radius-base)',
        'sr-md': 'var(--radius-base)',
        'sr-lg': 'var(--radius-lg)',
        'sr-pill': 'var(--radius-pill)',
      },

      // =======================================================================
      // BOX SHADOW
      // Layered shadows for depth hierarchy
      // =======================================================================
      boxShadow: {
        // Base shadows
        xs: 'var(--shadow-sm)',
        sm: 'var(--shadow)',
        DEFAULT: 'var(--shadow-md)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',

        // Named shadows
        card: 'var(--shadow-card, var(--shadow-md))',
        header: 'var(--shadow-header, 0 1px 3px 0 rgb(0 0 0 / 0.1))',
        modal: 'var(--shadow-modal, var(--shadow-xl))',

        // Guest shadows
        'guest-xs': 'var(--guest-shadow-xs)',
        'guest-sm': 'var(--guest-shadow-sm)',
        'guest-md': 'var(--guest-shadow-md)',
        'guest-lg': 'var(--guest-shadow-lg)',
        'guest-xl': 'var(--guest-shadow-xl)',
        'guest-glow': 'var(--guest-shadow-glow)',
      },

      // =======================================================================
      // ANIMATIONS & KEYFRAMES
      // All animations use transform/opacity only for performance
      // =======================================================================
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-down': {
          from: { opacity: '0', transform: 'translateY(-10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(100%)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-down': {
          from: { opacity: '0', transform: 'translateY(-100%)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(10px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'appear-from-right': {
          from: { opacity: '0.3', transform: 'translate(12%, 0)' },
          to: { opacity: '1', transform: 'translate(0, 0)' },
        },
        shimmer: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 0 0 hsl(var(--primary) / 0.4)' },
          '50%': { boxShadow: '0 0 0 8px hsl(var(--primary) / 0)' },
        },
        wiggle: {
          '0%, 20%, 80%, 100%': { transform: 'rotate(0deg)' },
          '30%, 60%': { transform: 'rotate(-2deg)' },
          '40%, 70%': { transform: 'rotate(2deg)' },
          '45%': { transform: 'rotate(-4deg)' },
          '55%': { transform: 'rotate(4deg)' },
        },
        popup: {
          '0%': { transform: 'scale(0.8)', opacity: '0.8' },
          '50%': { transform: 'scale(1.1)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        celebrate: {
          '0%': { transform: 'scale(0.8) rotate(-5deg)', opacity: '0' },
          '50%': { transform: 'scale(1.1) rotate(3deg)' },
          '100%': { transform: 'scale(1) rotate(0deg)', opacity: '1' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-4px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(4px)' },
        },
        opacity: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },

      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        'fade-up': 'fade-up 0.3s ease-out',
        'fade-down': 'fade-down 0.3s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
        'slide-up': 'slide-up 0.3s ease-out',
        'slide-down': 'slide-down 0.3s ease-out',
        'slide-in-right': 'slide-in-right 0.3s ease-out',
        'appear-from-right': 'appear-from-right 0.3s ease-in-out',
        shimmer: 'shimmer 2s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        wiggle: 'wiggle 1.5s ease-in-out infinite',
        popup: 'popup 0.25s ease-in-out',
        celebrate: 'celebrate 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
        shake: 'shake 0.5s ease-in-out',
        opacity: 'opacity 0.25s ease-in-out',
      },

      // =======================================================================
      // TRANSITIONS
      // Standardized timing functions and durations
      // =======================================================================
      transitionTimingFunction: {
        'srx-standard': 'var(--pg-ease-spring)',
        'guest-ease': 'var(--pg-ease-out)',
      },

      transitionDuration: {
        fast: 'var(--pg-duration-fast)',
        base: 'var(--pg-duration)',
        slow: 'var(--pg-duration-slow)',
      },

      // =======================================================================
      // LAYOUT
      // Container and max-width utilities
      // =======================================================================
      maxWidth: {
        '7xl': '80rem',
        'guest-narrow': '48rem',
        'guest-default': '70rem',
        'guest-wide': '90rem',
      },
    },
  },
  plugins: [],
};
