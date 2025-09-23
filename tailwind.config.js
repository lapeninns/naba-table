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
        sans: ["var(--font-inter)", ...fontFamily.sans],
      },
      fontSize: {
        body: ["var(--srx-type-base)", { lineHeight: "1.6" }],
        "body-sm": ["var(--srx-type-sm)", { lineHeight: "1.5" }],
        helper: ["var(--srx-type-helper)", { lineHeight: "1.45" }],
      },
      spacing: {
        "srx-card": "var(--srx-space-card)",
        "srx-section": "var(--srx-space-section)",
        "safe-b": "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)",
      },
      boxShadow: {
        "srx-card": "0 18px 36px -16px rgba(15, 23, 42, 0.15)",
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
};
