import { opsHref } from '@/lib/url/opsHref';

import type { GoogleBusinessProfileConnection } from '@/services/ops/restaurants';

export const GBP_ANCHOR_IDS = ['gbp-connection', 'gbp-location', 'gbp-sync-review'] as const;

export type GbpAnchorId = (typeof GBP_ANCHOR_IDS)[number];
export type GbpWorkflowStage = 'connect' | 'location' | 'linked' | 'issue';
export type GbpStepStatus = 'complete' | 'active' | 'blocked' | 'pending';
export type PersistentGbpErrorKind = 'authorization' | 'callback' | 'disconnect' | 'link';
export type PersistentGbpError = {
  kind: PersistentGbpErrorKind;
  title: string;
  message: string;
};

const GBP_ANCHOR_ID_SET = new Set<string>(GBP_ANCHOR_IDS);

export const PROFILE_CONTACT_HREF = opsHref('/settings/restaurant/profile#profile-contact');
export const AVAILABILITY_SCHEDULE_HREF = opsHref(
  '/settings/restaurant/availability#availability-schedule',
);

export function isGbpAnchorId(value: string): value is GbpAnchorId {
  return GBP_ANCHOR_ID_SET.has(value);
}

export function getStage(
  data: GoogleBusinessProfileConnection | null | undefined,
): GbpWorkflowStage {
  if (!data || data.status === 'unlinked' || data.status === 'pending_auth') {
    return 'connect';
  }
  if (data.status === 'authorized') {
    return 'location';
  }
  if (data.status === 'reauth_required' || data.status === 'sync_error') {
    return 'issue';
  }
  return 'linked';
}

export function getStageLabel(stage: GbpWorkflowStage): string {
  switch (stage) {
    case 'linked':
      return 'Linked and ready';
    case 'location':
      return 'Choose location';
    case 'issue':
      return 'Action needed';
    case 'connect':
    default:
      return 'Connect Google';
  }
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

export function getStepStatus(
  step: 'connect' | 'location' | 'review',
  data: GoogleBusinessProfileConnection | null,
  stage: GbpWorkflowStage,
): GbpStepStatus {
  if (!data || data.status === 'unlinked' || data.status === 'pending_auth') {
    return step === 'connect' ? 'active' : 'blocked';
  }
  if (data.status === 'authorized' || data.status === 'reauth_required') {
    if (step === 'connect') return 'complete';
    if (step === 'location') return 'active';
    return 'blocked';
  }
  if (data.status === 'sync_error') {
    return step === 'review' ? 'active' : 'complete';
  }
  if (stage === 'linked') {
    return step === 'review' ? 'pending' : 'complete';
  }
  return 'pending';
}

export function stepBadgeLabel(status: GbpStepStatus): string | undefined {
  if (status === 'complete') return 'Done';
  if (status === 'active') return 'Now';
  if (status === 'blocked') return 'Locked';
  return undefined;
}
