/**
 * Shared floor-plan control styling.
 *
 * The shadcn focus-visible default uses the mid-gray `--ring` token, which the audit flagged as
 * low-contrast against the white table tiles. Floor-plan interactive controls instead use a
 * cobalt (`--primary`) focus ring so keyboard focus is clearly visible on the map and its
 * controls. Applied via `cn()` (tailwind-merge), so it overrides the primitive's default ring.
 */
export const FLOOR_FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';
