import type { TableInventory } from '@/services/ops/tables';
import type { TableTimelineBookingRef, TableTimelineSegment } from '@/types/ops';

/**
 * The seven operational service states a table can be in at a given moment,
 * derived from real booking lifecycle + timeline segments (see serviceState.ts).
 * Each state is rendered as a colour dot AND a label — never colour alone.
 */
export type ServiceState =
  | 'free'
  | 'held'
  | 'confirmed'
  | 'seated'
  | 'finishing'
  | 'overdue'
  | 'walkin';

export type ServiceStateTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

export type ServiceStateMeta = {
  label: string;
  tone: ServiceStateTone;
  /** Booked-ahead states sit "ahead" of service; occupied states hold the floor now. */
  booked: boolean;
  occupied: boolean;
};

export const SERVICE_STATE_META: Record<ServiceState, ServiceStateMeta> = {
  free: { label: 'Free', tone: 'neutral', booked: false, occupied: false },
  held: { label: 'Held', tone: 'primary', booked: true, occupied: false },
  confirmed: { label: 'Confirmed', tone: 'primary', booked: true, occupied: false },
  seated: { label: 'Seated', tone: 'success', booked: false, occupied: true },
  finishing: { label: 'Finishing', tone: 'warning', booked: false, occupied: true },
  overdue: { label: 'Overdue', tone: 'danger', booked: false, occupied: true },
  walkin: { label: 'Walk-in', tone: 'info', booked: false, occupied: true },
};

/** Legend / filter ordering — most operationally urgent first. */
export const SERVICE_STATE_ORDER: ServiceState[] = [
  'seated',
  'finishing',
  'walkin',
  'overdue',
  'confirmed',
  'held',
  'free',
];

/** A table inventory row joined with its timeline segments for the active date. */
export type FloorPlanTable = TableInventory & {
  segments: TableTimelineSegment[];
};

/** Raw stored coordinate ({x,y} in the venue's own units, optional rotation). */
export type RawPosition = { x: number; y: number; rotation: number };

/** A position expressed as a percentage of the canvas (after bbox normalisation). */
export type NormalizedPosition = { xPercent: number; yPercent: number; rotation: number };

/** Geometry of a rendered table node (size + corner radius + roundness). */
export type TableGeom = { w: number; h: number; r: number | string; round: boolean };

/** The result of resolving a table's live state at a scrub time T. */
export type ResolvedTableState = {
  state: ServiceState;
  segment: TableTimelineSegment | null;
  booking: TableTimelineBookingRef | null;
  /** Out-of-service / inactive tables render disabled, outside the seven states. */
  outOfService: boolean;
};
