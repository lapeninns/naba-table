/**
 * Ops console density classes.
 *
 * Luma 2.0 introduced a surface-scoped density scale in the token layer
 * (`--pg-density-*` in styles/design-system/public-guest.tokens.css): comfortable
 * by default, compact under `[data-theme='app']`. Consts here compose those
 * tokens directly — including the card padding, whose prior responsive `sm:`
 * bump now lives in the token layer (a sm+ media query bumps `--pg-density-card-px`)
 * so these classes stay branch-free while rendering identically on the ops surface.
 */

export const OPS_CARD_CLASS = 'border-border/70 shadow-none';

export const OPS_CARD_HEADER_CLASS =
  'px-[var(--pg-density-card-px)] py-[var(--pg-density-card-py)]';

export const OPS_CARD_CONTENT_CLASS =
  'px-[var(--pg-density-card-px)] pb-[var(--pg-density-gap-tight)]';

export const OPS_CARD_FOOTER_CLASS =
  'border-t bg-muted/40 px-[var(--pg-density-card-px)] py-[var(--pg-density-card-py)]';

// Driven by the density token (compact ops surface → 1rem, matching the prior
// gap-4) so the content stack adapts with the surface's density.
export const OPS_PAGE_CONTENT_STACK_CLASS = 'flex flex-col gap-[var(--pg-density-gap-tight)]';

export const OPS_PAGE_RHYTHM_CLASS = 'space-y-5 sm:space-y-6';
