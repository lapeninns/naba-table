const { fontFamily } = require("tailwindcss/defaultTheme");

module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // AGENTS.md tokens
        'sr-primary': "var(--color-primary)",
        'sr-primary-pressed': "var(--color-primary-pressed)",
        'sr-accent': "var(--color-accent)",
        'sr-text-primary': "var(--color-text-primary)",
        'sr-text-secondary': "var(--color-text-secondary)",
        'sr-on-primary': "var(--color-on-primary)",
        'sr-surface': "var(--color-surface)",
        'sr-background': "var(--color-background)",
        'sr-border': "var(--color-border)",

        // Existing variables retained for backward-compat
        "srx-surface-positive": "var(--srx-surface-positive)",
        "srx-surface-positive-alt": "var(--srx-surface-positive-alt)",
        "srx-surface-info": "var(--srx-surface-info)",
        "srx-surface-warn": "var(--srx-surface-warn)",
        "srx-border-subtle": "var(--srx-border-subtle)",
        "srx-border-strong": "var(--srx-border-strong)",
        "srx-ink-strong": "var(--srx-ink-strong)",
        "srx-ink-muted": "var(--srx-ink-muted)",
        "srx-ink-soft": "var(--srx-ink-soft)",
        "srx-brand": "var(--srx-brand)",
        "srx-brand-soft": "var(--srx-brand-soft)",
      },
      fontFamily: {
        sans: ["var(--font-sajilo)", ...fontFamily.sans],
      },
      fontSize: {
        // AGENTS.md scale
        'screen-title': ["34px", { lineHeight: "40px", fontWeight: "700" }],
        'section-header': ["22px", { lineHeight: "28px", fontWeight: "600" }],
        'card-title': ["18px", { lineHeight: "22px", fontWeight: "600" }],
        body: ["16px", { lineHeight: "24px", fontWeight: "400" }],
        label: ["14px", { lineHeight: "20px", fontWeight: "400" }],
        button: ["16px", { lineHeight: "20px", fontWeight: "600" }],
        // legacy
        "body-sm": ["var(--srx-type-sm)", { lineHeight: "1.5" }],
        helper: ["var(--srx-type-helper)", { lineHeight: "1.45" }],
      },
      spacing: {
        "srx-card": "var(--srx-space-card)",
        "srx-section": "var(--srx-space-section)",
        "safe-b": "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)",
        // AGENTS.md named constants
        'screen-margin': 'var(--screen-margin)',
        'card-padding': 'var(--card-padding)',
        'button-height': 'var(--button-height)',
        'touch-target': 'var(--touch-target)',
      },
      boxShadow: {
        // AGENTS.md shadows
        card: "var(--shadow-card)",
        header: "var(--shadow-header)",
        modal: "var(--shadow-modal)",
        // existing
        "srx-card": "0 18px 36px -16px rgba(15, 23, 42, 0.15)",
      },
      borderRadius: {
        'sr-sm': 'var(--radius-sm)',
        'sr-md': 'var(--radius-md)',
        'sr-lg': 'var(--radius-lg)',
      },
      transitionTimingFunction: {
        "srx-standard": "var(--srx-easing-standard)",
      },
      transitionDuration: {
        fast: "150ms",
      },
      maxWidth: {
        "7xl": "80rem",
      },
    },
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: ["light", "dark", "cupcake"],
    darkTheme: "dark",
    base: true,
    styled: true,
    utils: true,
    prefix: "",
    logs: true,
  },
};
