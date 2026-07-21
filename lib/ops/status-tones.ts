/**
 * Centralized ops status badge tone vocabulary.
 *
 * Two-layer model:
 * 1. Shared tone → shadcn Badge styling mapping (this file).
 * 2. Domain-specific helpers that map business status to tone (co-located
 *    with each feature's status definitions).
 *
 * Never map an arbitrary status string directly to styling without
 * going through a domain helper — that's how 15 duplicate tone maps happen.
 */

import type { BadgeProps } from '@/components/ui/badge';

/**
 * Semantic tone vocabulary for ops status badges.
 *
 * These are intentionally broad; domain helpers narrow them down
 * by mapping specific business statuses to the closest tone.
 */
export type OpsStatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'muted';

/**
 * Canonical shadcn Badge variant for each semantic tone.
 *
 * Uses `variant="outline"` with tone-specific color classes rather than
 * hardcoding variant names per status, because outline+color gives the
 * most consistent visual treatment across the ops surface.
 */
export const OPS_STATUS_TONE_VARIANT: Record<OpsStatusTone, BadgeProps['variant']> = {
  neutral: 'outline',
  success: 'outline',
  warning: 'outline',
  danger: 'outline',
  info: 'outline',
  muted: 'outline',
};

/**
 * Tailwind classes for each tone, designed to layer on top of
 * shadcn Badge `variant="outline"`.
 *
 * Applied via the `OpsStatusBadge` component in
 * `src/components/features/ops-shell/patterns/OpsStatusBadge.tsx`.
 *
 * Luma 2.0 — full semantic palette. Each state carries its own hue
 * (success = green, warning = amber, info = blue, danger = red) rather than
 * the previous calm two-hue (cobalt + red) treatment, for clearer state
 * signalling. `neutral` keeps the cobalt brand accent; `muted` stays gray.
 * All hues resolve from the shared `--success` / `--warning` / `--info` /
 * `--destructive` tokens (light + dark, both surfaces), mirroring the
 * semantic tint pattern already used by the Badge and Alert primitives.
 */
export const OPS_STATUS_TONE_CLASSES: Record<OpsStatusTone, string> = {
  neutral: 'bg-primary/10 text-primary border-primary/20',
  success: 'bg-success/10 text-success border-success/30',
  warning: 'bg-warning/10 text-warning border-warning/40',
  danger: 'bg-destructive/10 text-destructive border-destructive/20',
  info: 'bg-info/10 text-info border-info/30',
  muted: 'bg-muted text-muted-foreground border-border/60',
};

/**
 * Convenience: get the full className for a given tone.
 */
export function getOpsStatusToneClass(tone: OpsStatusTone): string {
  return OPS_STATUS_TONE_CLASSES[tone];
}
