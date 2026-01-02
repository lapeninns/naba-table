---
skill: frontend-aesthetics
version: 1.0
category: design
phases: [2, 4]
updated: 2025-12-22
---

# Frontend Aesthetics Skill

**Purpose**: Create distinctive, delightful frontends that avoid generic "AI slop" aesthetics and establish memorable visual identity.

**When to Use**:

- **Phase 2 (Design & Planning)** — Define visual direction and design system choices
- **Phase 4 (Verification)** — Validate aesthetic quality and brand alignment

---

## Implementation Guardrails

- Use Shadcn UI primitives for all UI; compose and extend instead of introducing custom base components.
- Any exception requires maintainer approval and documentation in `plan.md`.

---

## Core Philosophy: Avoid "AI Slop"

"AI slop" refers to the homogeneous, lifeless aesthetic that emerges when AI generates without intentional design direction. Characteristics include:

- Purple-to-blue gradients on plain white backgrounds
- Inter, Roboto, or Space Grotesk fonts
- Cookie-cutter card layouts with rounded corners
- Bland, safe color palettes
- Lack of personality or brand voice

**Our goal is the opposite**: distinctive, memorable interfaces that could only belong to _this_ product.

---

## Typography

### Principles

1. **Choose fonts with personality** that match brand voice
2. **Establish clear hierarchy** with intentional size/weight ratios
3. **Optimize for readability** across devices and contexts

### Do ✅

```css
/* Use distinctive typefaces with character */
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,700&family=Work+Sans:wght@400;500;600&display=swap');

:root {
  --font-display: 'Fraunces', Georgia, serif;
  --font-body: 'Work Sans', system-ui, sans-serif;

  /* Clear typographic scale */
  --text-xs: 0.75rem; /* 12px */
  --text-sm: 0.875rem; /* 14px */
  --text-base: 1rem; /* 16px */
  --text-lg: 1.125rem; /* 18px */
  --text-xl: 1.25rem; /* 20px */
  --text-2xl: 1.5rem; /* 24px */
  --text-3xl: 1.875rem; /* 30px */
  --text-4xl: 2.25rem; /* 36px */
}

h1,
h2,
h3 {
  font-family: var(--font-display);
  font-weight: 700;
  letter-spacing: -0.02em;
}

body {
  font-family: var(--font-body);
  font-weight: 400;
  line-height: 1.6;
}
```

### Don't ❌

```css
/* Avoid generic, overused fonts */
font-family: 'Inter', sans-serif;
font-family: 'Roboto', sans-serif;
font-family: 'Space Grotesk', sans-serif;

/* Avoid arbitrary sizing without a scale */
font-size: 17px;
font-size: 23px;
```

### Recommended Font Pairings

| Brand Voice           | Display                               | Body                       |
| --------------------- | ------------------------------------- | -------------------------- |
| **Warm & Inviting**   | Fraunces, Playfair Display            | Work Sans, Source Sans Pro |
| **Modern & Clean**    | Sora, Outfit                          | DM Sans, Plus Jakarta Sans |
| **Bold & Confident**  | Clash Display, Cabinet Grotesk        | Satoshi, General Sans      |
| **Elegant & Refined** | Cormorant Garamond, Libre Baskerville | Lora, Crimson Pro          |

---

## Color & Theme

### Principles

1. **Start with intention** — colors should evoke specific emotions
2. **Use HSL for flexibility** — easy to create cohesive palettes
3. **Design for both light and dark modes** from the start
4. **Ensure sufficient contrast** for accessibility (WCAG AA minimum)

### Do ✅

```css
:root {
  /* Primary palette - using HSL for easy adjustment */
  --hue-primary: 145;
  --primary-50: hsl(var(--hue-primary), 60%, 97%);
  --primary-100: hsl(var(--hue-primary), 55%, 92%);
  --primary-500: hsl(var(--hue-primary), 50%, 45%);
  --primary-600: hsl(var(--hue-primary), 55%, 38%);
  --primary-900: hsl(var(--hue-primary), 60%, 15%);

  /* Semantic colors */
  --color-surface: var(--primary-50);
  --color-surface-elevated: white;
  --color-text-primary: var(--primary-900);
  --color-text-secondary: hsl(var(--hue-primary), 20%, 45%);

  /* Accent for visual interest */
  --hue-accent: 25;
  --accent-500: hsl(var(--hue-accent), 85%, 55%);
}

[data-theme='dark'] {
  --color-surface: hsl(var(--hue-primary), 25%, 8%);
  --color-surface-elevated: hsl(var(--hue-primary), 20%, 12%);
  --color-text-primary: hsl(var(--hue-primary), 15%, 95%);
  --color-text-secondary: hsl(var(--hue-primary), 10%, 65%);
}
```

### Don't ❌

```css
/* Avoid the purple-blue gradient cliché */
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

/* Avoid pure black/white without warmth */
color: #000000;
background: #ffffff;

/* Avoid generic blue as primary */
--primary: #3b82f6;
```

### Color Selection Framework

1. **Choose a hero hue** that reflects brand personality
2. **Generate a scale** from 50 (lightest) to 900 (darkest)
3. **Add a complementary accent** for calls-to-action and highlights
4. **Test both modes** — light and dark should feel intentional

---

## Motion & Animation

### Principles

1. **Motion should be purposeful** — guide attention, provide feedback
2. **Respect `prefers-reduced-motion`** — always provide fallbacks
3. **Keep durations short** — most transitions under 300ms
4. **Use easing that feels natural** — avoid linear for UI elements

### Do ✅

```css
:root {
  /* Timing */
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 400ms;

  /* Easing - custom curves for personality */
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
}

.button {
  transition:
    transform var(--duration-fast) var(--ease-out),
    background-color var(--duration-normal) var(--ease-out);
}

.button:hover {
  transform: translateY(-2px);
}

.button:active {
  transform: translateY(0);
}

/* Always respect user preference */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

```tsx
// React: Staggered entrance animation
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
  },
};
```

### Don't ❌

```css
/* Avoid slow, distracting animations */
transition: all 1s ease;

/* Avoid animating expensive properties */
transition:
  width 300ms,
  height 300ms,
  box-shadow 300ms;

/* Avoid linear easing for UI (feels robotic) */
transition: transform 200ms linear;
```

---

## Backgrounds & Depth

### Principles

1. **Add atmosphere** — backgrounds should enhance, not just fill
2. **Create depth** with subtle gradients and layers
3. **Use texture sparingly** for visual interest
4. **Ensure content remains readable**

### Do ✅

```css
/* Subtle gradient backgrounds */
.hero {
  background: linear-gradient(
    180deg,
    hsl(var(--hue-primary), 30%, 98%) 0%,
    hsl(var(--hue-primary), 25%, 95%) 100%
  );
}

/* Noise texture for warmth */
.surface-warm {
  background-color: var(--color-surface);
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
  background-blend-mode: soft-light;
  background-size: 200px;
}

/* Layered depth with shadows */
.card {
  background: var(--color-surface-elevated);
  box-shadow:
    0 1px 2px hsl(var(--hue-primary), 20%, 20%, 0.04),
    0 4px 8px hsl(var(--hue-primary), 20%, 20%, 0.04),
    0 16px 32px hsl(var(--hue-primary), 20%, 20%, 0.04);
}
```

### Don't ❌

```css
/* Avoid flat, single-color backgrounds */
background: #f5f5f5;

/* Avoid harsh shadows */
box-shadow: 0 10px 20px rgba(0, 0, 0, 0.3);

/* Avoid distracting patterns */
background: url('busy-pattern.png') repeat;
```

---

## Layout & Spacing

### Principles

1. **Use a consistent spacing scale** — multiples of 4px or 8px
2. **Create visual rhythm** through intentional white space
3. **Avoid cookie-cutter grid layouts** — add visual interest
4. **Design for the content**, not arbitrary containers

### Do ✅

```css
:root {
  /* 4px base spacing scale */
  --space-1: 0.25rem; /* 4px */
  --space-2: 0.5rem; /* 8px */
  --space-3: 0.75rem; /* 12px */
  --space-4: 1rem; /* 16px */
  --space-6: 1.5rem; /* 24px */
  --space-8: 2rem; /* 32px */
  --space-12: 3rem; /* 48px */
  --space-16: 4rem; /* 64px */
  --space-24: 6rem; /* 96px */
}

/* Asymmetric layouts for interest */
.feature-grid {
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  gap: var(--space-8);
}

/* Generous section padding */
.section {
  padding-block: var(--space-16);
}
```

---

## Decision Framework

Before finalizing any design, answer these questions:

### 1. Is it distinctive?

- [ ] Would this be instantly recognizable as _our_ product?
- [ ] Does it avoid common AI-generated patterns?
- [ ] Does the typography have personality?

### 2. Is it intentional?

- [ ] Can you justify every color choice?
- [ ] Does the motion serve a purpose?
- [ ] Is there a clear visual hierarchy?

### 3. Is it delightful?

- [ ] Are there moments of surprise or pleasure?
- [ ] Do interactions feel responsive and alive?
- [ ] Would users _want_ to use this?

### 4. Is it accessible?

- [ ] WCAG AA contrast ratios met?
- [ ] Reduced motion preference respected?
- [ ] Works without color alone?

---

## Anti-Patterns to Avoid

| ❌ AI Slop                 | ✅ Intentional Design               |
| -------------------------- | ----------------------------------- |
| Purple-to-blue gradient    | Brand-aligned gradient with purpose |
| Inter/Roboto/Space Grotesk | Distinctive typeface matching voice |
| Pure white background      | Warm surface with subtle depth      |
| Cookie-cutter card grid    | Asymmetric, content-driven layout   |
| Heavy drop shadows         | Layered, subtle shadows             |
| Generic blue buttons       | Brand-colored, tactile interactions |
| Boring hover states        | Micro-animations with personality   |

---

## Verification Checklist

```text
# Typography
[ ] Not using Inter/Roboto/Space Grotesk
[ ] Display and body fonts are intentionally paired
[ ] Typographic scale is consistent

# Color
[ ] Not using purple-blue gradient
[ ] HSL-based palette with clear hierarchy
[ ] Both light and dark modes designed
[ ] Contrast ratios meet WCAG AA

# Motion
[ ] Animations serve a purpose
[ ] Durations under 300ms for micro-interactions
[ ] prefers-reduced-motion respected
[ ] Custom easing (not linear)

# Backgrounds & Depth
[ ] Surfaces have depth and warmth
[ ] Shadows are layered and subtle
[ ] No harsh black shadows

# Overall
[ ] Would pass "stop scrolling" test
[ ] Feels distinctive, not generic
[ ] Consistent with brand personality
```
