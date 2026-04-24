# UI & Frontend Standards

Reference for frontend component, accessibility, and UX standards. For binding rules, see root `/AGENTS.md`.

## Components

- Use shadcn/ui primitives for all UI; extend and compose rather than rebuild.
- Exceptions require maintainer approval and plan.md justification.

## Mobile-First

- Build for small screens first; enhance for larger screens.
- Core flows should degrade gracefully with minimal JS.

## Accessibility (required)

- Full keyboard navigation; manage focus (trap in modals, restore on close)
- Visible focus via `:focus-visible`
- Semantic HTML first; ARIA only when needed
- Accessible names/labels; no color-only cues
- Hierarchical headings; per-view titles
- Toasts/validation use polite `aria-live`

## Forms

- Inputs ≥16px font on mobile
- Correct `type`, `inputmode`, `autocomplete`
- Submit triggers inline validation; focus first error
- Permit paste; trim values; warn on unsaved changes
- `Enter` submits single-line; `Ctrl/⌘+Enter` submits textareas

## Navigation & State

- Reflect state in URL (filters, tabs, pagination)
- Restore scroll on back/forward
- Use `<a>/<Link>` for new-tab and middle-click support

## Touch & Targets

- Hit area ≥24px (mobile ≥44px)
- `touch-action: manipulation` where appropriate

## Motion & Layout

- Respect `prefers-reduced-motion`
- Animate only `transform`/`opacity`; animations are interruptible
- Test mobile, laptop, ultra-wide; avoid accidental scrollbars
- Respect safe areas with `env(safe-area-inset-*)`

## Performance

- Minimize re-renders; virtualize large lists
- Prevent image-induced CLS (reserve space)
- Target <500ms for common user-visible mutations (P95)
