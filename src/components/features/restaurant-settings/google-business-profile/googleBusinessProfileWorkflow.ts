import { opsHref } from '@/lib/url/opsHref';

import { AVAILABILITY_ANCHORS, availabilityHash } from '../availabilityAnchors';

import type { DualSyncSectionKey } from '@/server/dual-sync';
import type { GoogleBusinessProfileConnection } from '@/services/ops/restaurants';

export const GBP_ANCHOR_IDS = ['gbp-connection', 'gbp-location', 'gbp-sync-review'] as const;

export type GbpAnchorId = (typeof GBP_ANCHOR_IDS)[number];
export type GbpConnectionStatus = GoogleBusinessProfileConnection['status'];
/** Step 2: locked until step 1 is done, then choose a listing, then chosen. */
export type GbpLocationStep = 'locked' | 'choose' | 'chosen';
export type PersistentGbpErrorKind = 'authorization' | 'callback' | 'disconnect' | 'link';
export type PersistentGbpError = {
  kind: PersistentGbpErrorKind;
  title: string;
  message: string;
};

const GBP_ANCHOR_ID_SET = new Set<string>(GBP_ANCHOR_IDS);

export const PROFILE_CONTACT_HREF = opsHref('/settings/restaurant/profile#profile-contact');
export const AVAILABILITY_SCHEDULE_HREF = opsHref(
  `/settings/restaurant/availability${availabilityHash(AVAILABILITY_ANCHORS.availabilitySchedule)}`,
);

const CONNECTION_DESCRIPTIONS: Record<GbpConnectionStatus, string> = {
  unlinked: 'Connect Google to start.',
  pending_auth: 'Finish signing in on the Google window.',
  authorized: 'Google is connected. Pick the listing for this restaurant.',
  linked: 'Connected and a location is chosen.',
  sync_error: 'The last check with Google failed. Your saved settings are unchanged.',
  reauth_required: 'Google access expired. Reconnect to keep comparing and publishing.',
};

export function isGbpAnchorId(value: string): value is GbpAnchorId {
  return GBP_ANCHOR_ID_SET.has(value);
}

export function getGbpConnectionDescription(status: GbpConnectionStatus): string {
  return CONNECTION_DESCRIPTIONS[status];
}

/** Step 1 is done once Google has authorised Nabatable, even if access later needs renewing. */
export function isGbpConnectionStepDone(status: GbpConnectionStatus): boolean {
  return status !== 'unlinked' && status !== 'pending_auth';
}

export function getGbpLocationStep(status: GbpConnectionStatus): GbpLocationStep {
  if (status === 'linked' || status === 'sync_error') return 'chosen';
  if (status === 'authorized' || status === 'reauth_required') return 'choose';
  return 'locked';
}

export function getLocationTitle(data: GoogleBusinessProfileConnection | null): string {
  if (!data) {
    return 'Google Business Profile';
  }
  return data.externalLocationTitle ?? data.externalLocationName ?? 'Google Business Profile';
}

export function getConnectedAccountLabel(data: GoogleBusinessProfileConnection | null): string {
  if (!data) {
    return 'No Google account connected';
  }
  return data.connectedGoogleEmail ?? data.connectedGoogleName ?? 'Google account not connected';
}

/** The dual-sync sections reviewed in step 3 of the Google Business Profile page. */
export const GBP_REVIEW_SECTIONS: ReadonlyArray<DualSyncSectionKey> = [
  'profile',
  'operatingHours',
  'servicePeriods',
  'businessContext.categories',
  'businessContext.serviceAreas',
  'businessContext.attributes',
  'businessContext.serviceItems',
  'foodMenus',
];
