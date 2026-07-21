/**
 * Ops console density classes.
 *
 * Luma 2.0 introduced a surface-scoped density scale in the token layer
 * (`--pg-density-*` in styles/design-system/public-guest.tokens.css): comfortable
 * by default, compact under `[data-theme='app']`. Consts here compose those
 * tokens where the value is a clean single step; the card padding consts keep
 * their responsive `sm:` bumps for now and are the next adoption target.
 */

export const OPS_CARD_CLASS = 'border-border/70 shadow-none';

export const OPS_CARD_HEADER_CLASS = 'px-4 py-3 sm:px-5';

export const OPS_CARD_CONTENT_CLASS = 'px-4 pb-4 sm:px-5';

export const OPS_CARD_FOOTER_CLASS = 'border-t bg-muted/40 px-4 py-3 sm:px-5';

// Driven by the density token (compact ops surface → 1rem, matching the prior
// gap-4) so the content stack adapts with the surface's density.
export const OPS_PAGE_CONTENT_STACK_CLASS = 'flex flex-col gap-[var(--pg-density-gap-tight)]';

export const OPS_PAGE_RHYTHM_CLASS = 'space-y-5 sm:space-y-6';
