import type { ServiceState } from './domain/types';
import type { OpsStatusTone } from '@/lib/ops/status-tones';

/**
 * Map a derived service state to the centralized ops status-badge tone vocabulary
 * (`lib/ops/status-tones`). This is an EXPLICIT remap, not a passthrough of
 * `SERVICE_STATE_META[state].tone`: the two enums are incompatible (the domain
 * tone has `primary` and no `muted`; the ops tone has `muted` and no `primary`).
 * Used by every BADGE on the page (legend, detail, service status) so status
 * pills read exactly like every other ops surface.
 */
export function serviceTone(state: ServiceState): OpsStatusTone {
  switch (state) {
    case 'seated':
      return 'success';
    case 'finishing':
      return 'warning';
    case 'walkin':
      return 'info';
    case 'overdue':
      return 'danger';
    case 'held':
    case 'confirmed':
      return 'neutral';
    case 'free':
    default:
      return 'muted';
  }
}

/**
 * Floor-map tile surface (bg tint + border colour + text) by service state.
 *
 * The spatial map is the one surface that keeps the design system's semantic
 * status hues (success/warning/info/destructive + cobalt primary) so a service
 * lead can read the room at a glance; the calmer OpsStatusBadge tones are used
 * for every badge/chip elsewhere. Colour classes are the app's own semantic
 * tokens — no raw hex, no inline color-mix. Pair with a `border` width utility
 * on the node element (this returns the colour + dash style only).
 */
export function nodeSurfaceClass(state: ServiceState): string {
  switch (state) {
    case 'seated':
      return 'bg-success/10 border-success/45 text-foreground';
    case 'finishing':
      return 'bg-warning/10 border-warning/50 text-foreground';
    case 'overdue':
      return 'bg-destructive/10 border-destructive/50 text-foreground';
    case 'walkin':
      return 'bg-info/10 border-info/45 text-foreground';
    case 'confirmed':
      return 'bg-primary/5 border-primary/40 text-foreground';
    case 'held':
      return 'border-dashed border-primary/50 bg-card text-foreground';
    case 'free':
    default:
      return 'border-dashed border-border bg-muted/40 text-muted-foreground';
  }
}

/** Status-dot colour for a floor-map tile and the legend chip dot. */
export function nodeDotClass(state: ServiceState): string {
  switch (state) {
    case 'seated':
      return 'bg-success';
    case 'finishing':
      return 'bg-warning';
    case 'overdue':
      return 'bg-destructive';
    case 'walkin':
      return 'bg-info';
    case 'held':
    case 'confirmed':
      return 'bg-primary';
    case 'free':
    default:
      return 'bg-muted-foreground';
  }
}
