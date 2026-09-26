/**
 * Plain-language model for the Google Business Profile settings page: what the connection and
 * Google writes look like to staff, why "Send to Google" is unavailable, and review counts.
 * Pure, so the page components stay presentational.
 */

import type { DualSyncFieldState } from '@/server/dual-sync';
import type { DualSyncFieldSummary, GbpConnectionStateResponseV1 } from '@/services/ops/dual-sync';
import type { GoogleBusinessProfileConnection } from '@/services/ops/restaurants';

export type GbpTone = 'ok' | 'off' | 'bad';

const FIELD_STATE_LABEL: Record<DualSyncFieldState, string> = {
  in_sync: 'Matches',
  core_dirty: 'Changed in Nabatable',
  gbp_dirty: 'Changed on Google',
  drifted: 'Different',
  conflict: 'Changed on both',
  pending_import: 'Being saved in Nabatable',
  pending_export: 'Being sent to Google',
  import_failed: 'Couldn’t be saved in Nabatable',
  export_failed: 'Google rejected it',
  ignored: 'Ignored',
  unsupported: 'Nabatable only',
};

const HOT_STATES = new Set<DualSyncFieldState>(['conflict', 'export_failed', 'import_failed']);

/** "Changed on Google · Google-owned · High-risk", and whether it needs attention first. */
export function describeGbpFieldNotes(field: DualSyncFieldSummary): { text: string; hot: boolean } {
  const notes = [field.state ? FIELD_STATE_LABEL[field.state] : 'Not compared yet'];
  const { authority, riskLevel } = field.policy;
  if (authority === 'import_only' || authority === 'google_authoritative') {
    notes.push('Google-owned');
  }
  if (riskLevel === 'high' || riskLevel === 'critical') notes.push('High-risk');
  return { text: notes.join(' · '), hot: Boolean(field.state && HOT_STATES.has(field.state)) };
}

export function describeGbpConnection(status: GoogleBusinessProfileConnection['status']): {
  label: string;
  tone: GbpTone;
} {
  switch (status) {
    case 'linked':
      return { label: 'Linked', tone: 'ok' };
    case 'sync_error':
      return { label: 'Couldn’t reach Google', tone: 'bad' };
    case 'reauth_required':
      return { label: 'Reconnect needed', tone: 'bad' };
    case 'authorized':
      return { label: 'Choose a listing', tone: 'off' };
    case 'pending_auth':
      return { label: 'Waiting for Google', tone: 'off' };
    case 'unlinked':
    default:
      return { label: 'Not connected', tone: 'off' };
  }
}

type OperatorState = Pick<
  GbpConnectionStateResponseV1,
  'writeState' | 'reasonCode' | 'rollout' | 'pendingUpdates'
>;

function isFailStop(operator: OperatorState | null): boolean {
  return operator?.pendingUpdates.state === 'unknown';
}

/**
 * The "Google writes" status. Null when it is not known (write state is admin-only), so the page
 * never claims writes are on without the server saying so.
 */
export function describeGbpWrites({
  operator,
  unavailable,
}: {
  operator: OperatorState | null;
  unavailable: boolean;
}): { label: string; tone: GbpTone; sentence: string } | null {
  if (unavailable) {
    return { label: 'Unavailable', tone: 'bad', sentence: 'Treated as off until it loads' };
  }
  if (!operator) return null;
  if (isFailStop(operator)) {
    return { label: 'Stopped', tone: 'bad', sentence: 'Google has updates Nabatable can’t read' };
  }
  switch (operator.writeState) {
    case 'eligible':
      return {
        label: 'On',
        tone: 'ok',
        sentence: 'Nabatable may publish after you confirm an exact plan',
      };
    case 'revoking':
      return { label: 'Turning off…', tone: 'off', sentence: 'Write access is being revoked' };
    case 'disconnected':
      return { label: 'Off', tone: 'off', sentence: 'No listing is linked' };
    case 'reauth_required':
      return { label: 'Off', tone: 'bad', sentence: 'Waiting for Google to be reconnected' };
    case 'blocked':
    default:
      return { label: 'Off', tone: 'bad', sentence: 'Nothing can be published' };
  }
}

/** Why "Send to Google" is unavailable right now, most serious first; null when it is allowed. */
export function getGbpSendBlockReason({
  operator,
  operatorUnavailable,
  connectionStatus,
  syncPaused,
}: {
  operator: OperatorState | null;
  operatorUnavailable: boolean;
  connectionStatus: GoogleBusinessProfileConnection['status'];
  syncPaused: boolean;
}): string | null {
  if (operatorUnavailable) {
    return 'Write controls could not be loaded, so publishing to Google stays off. Reload the page to try again.';
  }
  if (connectionStatus === 'reauth_required') {
    return 'Google access has expired. Reconnect Google before anything can be sent.';
  }
  if (isFailStop(operator)) {
    return 'Publishing is stopped until Nabatable gets the latest from Google and you create a new preview.';
  }
  if (operator && !operator.rollout.eligible) {
    return 'Publishing to Google is not enabled for this venue yet. You can still use Google’s values in Nabatable.';
  }
  if (operator && operator.writeState !== 'eligible') {
    return 'Google writes are off. Turn them on under Operations.';
  }
  if (syncPaused) {
    return 'Sync is paused. Resume sync to publish or use Google’s values.';
  }
  return null;
}

export function isGbpFieldDifferent(field: DualSyncFieldSummary): boolean {
  return field.state !== 'in_sync';
}

export function summarizeGbpReview(
  fields: ReadonlyArray<DualSyncFieldSummary>,
  decisions: Readonly<Record<string, unknown>>,
): { differences: number; sectionsWithDifferences: number; decided: number; undecided: number } {
  const differing = fields.filter(isGbpFieldDifferent);
  const decided = differing.filter((field) => decisions[field.fieldKey]).length;
  return {
    differences: differing.length,
    sectionsWithDifferences: new Set(differing.map((field) => field.sectionKey)).size,
    decided,
    undecided: differing.length - decided,
  };
}

export function summarizeGbpSection(fields: ReadonlyArray<DualSyncFieldSummary>): {
  differing: number;
  total: number;
  label: string;
} {
  const differing = fields.filter(isGbpFieldDifferent).length;
  return {
    differing,
    total: fields.length,
    label: differing ? `${differing} of ${fields.length} differ` : 'All match',
  };
}

const DATE_TIME = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

/** "26 Sept, 13:58", or the fallback when there is no usable time. */
export function formatGbpTime(value: string | null | undefined, fallback = 'Never'): string {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : DATE_TIME.format(date);
}
