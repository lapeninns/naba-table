import { SERVICE_STATE_META } from './domain/types';

import type { ServiceState, ServiceStateTone } from './domain/types';

/** Tone → dot/background colour class (app semantic tokens; cobalt = primary). */
export const TONE_DOT: Record<ServiceStateTone, string> = {
  neutral: 'bg-muted-foreground',
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-destructive',
  info: 'bg-info',
};

/** Tone → text colour class. */
export const TONE_TEXT: Record<ServiceStateTone, string> = {
  neutral: 'text-muted-foreground',
  primary: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-destructive',
  info: 'text-info',
};

export function stateDotClass(state: ServiceState): string {
  return TONE_DOT[SERVICE_STATE_META[state].tone];
}

export function stateTextClass(state: ServiceState): string {
  return TONE_TEXT[SERVICE_STATE_META[state].tone];
}

/**
 * Surface (bg + border + text) class for a table node by service state. Occupied
 * states get a tinted fill + solid coloured border; booked-ahead states use cobalt;
 * held/free use dashed borders — mirroring the reference design.
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
