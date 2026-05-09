/**
 * Phase 1 of the unified dual-sync engine.
 *
 * Core-only fields. These fields exist on Nabatable Core but have no
 * Google Business Profile counterpart, so the registry marks them as
 * `unsupported`. They are surfaced in the registry so the UI can render
 * them with a definitive "Core only — not synced to Google" badge instead
 * of silently disappearing.
 */

import { withFieldPolicy } from './policy';

import type { DualSyncFieldConfig } from './types';

const noopNormalize = (value: unknown): unknown => value ?? null;

const coreOnlyConfig = (
  fieldKey: string,
  label: string,
  helpText: string,
  sortOrder: number,
): DualSyncFieldConfig =>
  withFieldPolicy({
    fieldKey,
    sectionKey: 'core_only',
    kind: 'core_only',
    label,
    helpText,
    corePath: fieldKey.replace(/^core\./, 'restaurant.'),
    gbpPath: '',
    importable: false,
    exportable: false,
    normalizeCoreValue: noopNormalize,
    normalizeGbpValue: () => null,
    canonicalizeCoreValue: noopNormalize,
    canonicalizeGbpValue: () => null,
    conflictPolicy: 'unsupported',
    deletePolicy: 'ignore',
    exportBlockedReason: 'This field is Nabatable-only and has no Google counterpart.',
    sortOrder,
  });

export const CORE_ONLY_FIELDS: ReadonlyArray<DualSyncFieldConfig> = [
  coreOnlyConfig(
    'core.bookingPolicy',
    'Booking policy',
    'Public booking policy text shown to guests on the reservation flow.',
    0,
  ),
  coreOnlyConfig(
    'core.capacity',
    'Capacity',
    'Internal floorplan capacity. Not exposed to Google.',
    1,
  ),
  coreOnlyConfig(
    'core.contactEmail',
    'Contact email',
    'Internal/ops contact email. Not exposed to Google.',
    2,
  ),
  coreOnlyConfig(
    'core.managerNotificationPhone',
    'Manager notification phone',
    'Phone number used for daily summary delivery. Not exposed to Google.',
    3,
  ),
  coreOnlyConfig(
    'core.managerDailySummaryEnabled',
    'Manager daily summary',
    'Internal preference for daily summary SMS delivery.',
    4,
  ),
  coreOnlyConfig(
    'core.timezone',
    'Timezone',
    'Operating timezone used for internal scheduling.',
    5,
  ),
  coreOnlyConfig(
    'core.logoUrl',
    'Logo URL',
    'Brand logo shown across the guest site. Not synced to Google.',
    6,
  ),
];
