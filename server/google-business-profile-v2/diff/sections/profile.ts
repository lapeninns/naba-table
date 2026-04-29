/**
 * Phase 2 of the GBP Dual-Sync V2 architecture.
 *
 * Profile section diff adapter. Capability flags mirror the legacy
 * `buildProfileVerificationSummary` rules:
 *  - `name` and `contactPhone` are push-capable to Google.
 *  - `address` is push-capable when Google already has enough storefront
 *    address structure for us to preserve region/locality fields while
 *    replacing address lines with Nabatable's reviewed value.
 *  - `businessDescription` is writable through the Google `profile` patch.
 *  - `googleMapUrl` and `googleReviewUrl` are Google-owned metadata links.
 *  - All profile fields are pull-capable into Nabatable when Google has a value.
 */

import { buildDiffItem, valuesEqual } from '../util';

import type { SyncV2ProfileSectionValue } from '../../snapshot/types';
import type { SyncV2DiffItem, SyncV2GoogleUpdateMask } from '../../types';

type ProfileDiffField = Exclude<keyof SyncV2ProfileSectionValue, 'storefrontAddress'>;

const PROFILE_FIELDS: ReadonlyArray<{
  readonly fieldKey: ProfileDiffField;
  readonly canExport: boolean;
  readonly googleUpdateMask?: SyncV2GoogleUpdateMask;
  readonly blockedReason?: string;
}> = [
  { fieldKey: 'name', canExport: true, googleUpdateMask: 'title' },
  { fieldKey: 'businessDescription', canExport: true, googleUpdateMask: 'profile' },
  { fieldKey: 'contactPhone', canExport: true, googleUpdateMask: 'phoneNumbers' },
  {
    fieldKey: 'address',
    canExport: true,
    googleUpdateMask: 'storefrontAddress',
    blockedReason:
      'Address export requires an existing Google storefrontAddress with a region code.',
  },
  {
    fieldKey: 'googleMapUrl',
    canExport: false,
    blockedReason: 'Google Maps URL is Google-owned metadata and is not directly writable.',
  },
  {
    fieldKey: 'googleReviewUrl',
    canExport: false,
    blockedReason: 'Google review URL is Google-owned metadata and is not directly writable.',
  },
];

export function diffProfile(
  nabatable: SyncV2ProfileSectionValue,
  google: SyncV2ProfileSectionValue,
): ReadonlyArray<SyncV2DiffItem<string | null, string | null>> {
  const items: Array<SyncV2DiffItem<string | null, string | null>> = [];
  PROFILE_FIELDS.forEach((spec, index) => {
    const nabValue = nabatable[spec.fieldKey];
    const gValue = google[spec.fieldKey];
    if (valuesEqual(nabValue, gValue)) return;
    const canExport =
      spec.fieldKey === 'address'
        ? Boolean(spec.canExport && nabValue !== null && google.storefrontAddress?.regionCode)
        : spec.fieldKey === 'businessDescription'
          ? spec.canExport
          : spec.canExport && nabValue !== null;
    items.push(
      buildDiffItem<string | null, string | null>({
        sectionKey: 'profile',
        fieldKey: spec.fieldKey,
        nabatable: nabValue,
        google: gValue,
        canImport: gValue !== null,
        canExport,
        googleUpdateMask: spec.googleUpdateMask,
        blockedReasons: canExport ? undefined : [spec.blockedReason ?? 'Field is not exportable.'],
        sortOrder: index,
      }),
    );
  });
  return items;
}
