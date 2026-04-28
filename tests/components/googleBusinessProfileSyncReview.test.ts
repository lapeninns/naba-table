import { describe, expect, it } from 'vitest';

import {
  buildDirectionSectionSummaries,
  buildDirectionStats,
  buildSelectedApprovalsForDirection,
  buildSelectedItemsForDirection,
  deriveInitialFieldDecisions,
  itemActionLabel,
} from '@/components/features/restaurant-settings/google-business-profile/lib/sync-review';

import type { GoogleBusinessProfileWorkflowDraft } from '@/services/ops/restaurants';

function buildDraft(status: string): GoogleBusinessProfileWorkflowDraft {
  return {
    id: 'draft-1',
    status,
    fetchedAt: '2026-04-28T15:32:37.849Z',
    approvedAt: null,
    publishedAt: status === 'published' ? '2026-04-28T15:34:16.839Z' : null,
    staleSections: [],
    conflictMetadata: {},
    selectedApprovals: {
      'operatingHours.override.2026-06-02': true,
    },
    sourceSnapshotRefs: {},
    coreSnapshotHashes: {},
    createdAt: '2026-04-28T15:32:37.849Z',
    updatedAt: '2026-04-28T15:34:16.839Z',
    sectionDiffs: [
      {
        sectionKey: 'operatingHours',
        label: 'Operating hours and special hours',
        status: 'ready',
        summary: 'Review special hours.',
        canPublishToNabatable: true,
        canPushToGoogle: true,
        blockedReasons: [],
        items: [
          {
            fieldKey: 'operatingHours.override.2026-06-02',
            label: 'Special hours 2026-06-02',
            sectionKey: 'operatingHours',
            currentValue: '12:00-22:30',
            providerValue: null,
            proposedValue: '12:00-22:30',
            direction: 'push_to_gbp',
            status: 'ready',
            selected: true,
            canPublishToNabatable: true,
            canPushToGoogle: true,
            warnings: [],
          },
        ],
      },
    ],
  };
}

describe('google business profile sync review state', () => {
  it('describes create and remove actions in admin-facing language', () => {
    const [item] = buildDraft('review_ready').sectionDiffs[0].items;

    expect(itemActionLabel(item, 'google_to_nabatable')).toBe('Remove from Nabatable');
    expect(itemActionLabel(item, 'nabatable_to_google')).toBe('Create in Google');

    expect(
      itemActionLabel(
        {
          ...item,
          currentValue: null,
          providerValue: '12:00-22:30',
        },
        'google_to_nabatable',
      ),
    ).toBe('Create in Nabatable');
    expect(
      itemActionLabel(
        {
          ...item,
          currentValue: null,
          providerValue: '12:00-22:30',
        },
        'nabatable_to_google',
      ),
    ).toBe('Remove from Google');
  });

  it('does not allow selections from a published review', () => {
    const draft = buildDraft('published');
    const decisions = deriveInitialFieldDecisions(draft);

    expect(decisions['operatingHours.override.2026-06-02']).toBe('keep_nabatable');
    expect(buildDirectionStats(draft, decisions, 'nabatable_to_google')).toEqual({
      selectedCount: 0,
      actionableCount: 0,
      blockedCount: 0,
      ignoredCount: 0,
    });
    expect(buildDirectionSectionSummaries(draft, decisions, 'nabatable_to_google')).toEqual([]);
    expect(buildSelectedItemsForDirection(draft, decisions, 'nabatable_to_google')).toEqual([]);
    expect(buildSelectedApprovalsForDirection(draft, decisions, 'nabatable_to_google')).toEqual({
      'operatingHours.override.2026-06-02': false,
    });
  });
});
