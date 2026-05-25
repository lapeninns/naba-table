import { describe, expect, it } from 'vitest';

import {
  FIELD_DECISIONS_METADATA_KEY,
  extractFieldDecisions,
  normalizeFieldDecisions,
  selectedApprovalsWithDecisions,
} from '@/server/google-business-profile/workflowFieldDecisions';

describe('google business profile workflow field decision helpers', () => {
  it('normalizes valid decisions and filters invalid metadata entries', () => {
    expect(
      normalizeFieldDecisions([
        {
          sectionKey: 'profile',
          fieldKey: 'profile.name',
          action: 'import_from_google',
          decidedByUserId: 'user-1',
          decidedAt: '2026-04-28T12:00:00.000Z',
          reviewedNabatableValueHash: 'nabatable-hash',
          reviewedGoogleValueHash: 'google-hash',
        },
        {
          sectionKey: 'profile',
          fieldKey: 'profile.phone',
          action: 'unsupported',
          reviewedNabatableValueHash: 'nabatable-hash',
          reviewedGoogleValueHash: 'google-hash',
        },
      ]),
    ).toEqual([
      {
        sectionKey: 'profile',
        fieldKey: 'profile.name',
        action: 'import_from_google',
        decidedByUserId: 'user-1',
        decidedAt: '2026-04-28T12:00:00.000Z',
        reviewedNabatableValueHash: 'nabatable-hash',
        reviewedGoogleValueHash: 'google-hash',
      },
    ]);
  });

  it('deduplicates decisions by field key with the latest entry winning', () => {
    expect(
      normalizeFieldDecisions([
        {
          sectionKey: 'profile',
          fieldKey: 'profile.name',
          action: 'ignore',
          reviewedNabatableValueHash: 'old-nabatable-hash',
          reviewedGoogleValueHash: 'old-google-hash',
        },
        {
          sectionKey: 'profile',
          fieldKey: 'profile.name',
          action: 'export_to_google',
          reviewedNabatableValueHash: 'new-nabatable-hash',
          reviewedGoogleValueHash: 'new-google-hash',
        },
      ]),
    ).toMatchObject([
      {
        fieldKey: 'profile.name',
        action: 'export_to_google',
        decidedByUserId: 'unknown',
        reviewedNabatableValueHash: 'new-nabatable-hash',
        reviewedGoogleValueHash: 'new-google-hash',
      },
    ]);
  });

  it('extracts decisions from selected approvals metadata', () => {
    expect(
      extractFieldDecisions({
        'profile.name': true,
        [FIELD_DECISIONS_METADATA_KEY]: [
          {
            sectionKey: 'profile',
            fieldKey: 'profile.name',
            action: 'import_from_google',
            reviewedNabatableValueHash: 'nabatable-hash',
            reviewedGoogleValueHash: 'google-hash',
          },
        ],
      }),
    ).toMatchObject([
      {
        sectionKey: 'profile',
        fieldKey: 'profile.name',
        action: 'import_from_google',
      },
    ]);
  });

  it('serializes selected approvals with decisions only when decisions exist', () => {
    expect(selectedApprovalsWithDecisions({ 'profile.name': true }, [])).toEqual({
      'profile.name': true,
    });

    expect(
      selectedApprovalsWithDecisions({ 'profile.name': true }, [
        {
          sectionKey: 'profile',
          fieldKey: 'profile.name',
          action: 'import_from_google',
          decidedByUserId: 'user-1',
          decidedAt: '2026-04-28T12:00:00.000Z',
          reviewedNabatableValueHash: 'nabatable-hash',
          reviewedGoogleValueHash: 'google-hash',
        },
      ]),
    ).toEqual({
      'profile.name': true,
      [FIELD_DECISIONS_METADATA_KEY]: [
        {
          sectionKey: 'profile',
          fieldKey: 'profile.name',
          action: 'import_from_google',
          decidedByUserId: 'user-1',
          decidedAt: '2026-04-28T12:00:00.000Z',
          reviewedNabatableValueHash: 'nabatable-hash',
          reviewedGoogleValueHash: 'google-hash',
        },
      ],
    });
  });
});
