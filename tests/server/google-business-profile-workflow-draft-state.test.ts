import { describe, expect, it } from 'vitest';

import {
  applySelectedApprovals,
  reconcileDraftWithCurrentSections,
  selectedApprovalsFromDecisions,
  summarizeSection,
  suppressActionsForReadOnlyReview,
} from '@/server/google-business-profile/workflowDraftState';

import type {
  WorkflowDraftState,
  WorkflowDraftStateItem,
  WorkflowDraftStateSection,
} from '@/server/google-business-profile/workflowDraftState';
import type { GoogleBusinessProfileFieldDecision } from '@/server/google-business-profile/workflowFieldDecisions';

type SectionKey = 'profile' | 'operatingHours';
type Item = WorkflowDraftStateItem<SectionKey>;
type Section = WorkflowDraftStateSection<SectionKey, Item>;
type Draft = WorkflowDraftState<SectionKey, Item, Section>;

function buildItem(fieldKey: string, overrides: Partial<Item> = {}): Item {
  return {
    fieldKey,
    label: overrides.label ?? fieldKey,
    sectionKey: overrides.sectionKey ?? 'profile',
    currentValue: overrides.currentValue ?? 'Nabatable',
    providerValue: overrides.providerValue ?? 'Google',
    status: overrides.status ?? 'ready',
    selected: overrides.selected ?? false,
    canPublishToNabatable: overrides.canPublishToNabatable ?? true,
    canPushToGoogle: overrides.canPushToGoogle ?? true,
    ...overrides,
  };
}

function buildSection(sectionKey: SectionKey, items: Item[]): Section {
  return summarizeSection(sectionKey, `${sectionKey} label`, items);
}

function buildDecision(
  fieldKey: string,
  action: GoogleBusinessProfileFieldDecision<SectionKey>['action'],
): GoogleBusinessProfileFieldDecision<SectionKey> {
  return {
    sectionKey: 'profile',
    fieldKey,
    action,
    decidedByUserId: 'user-1',
    decidedAt: '2026-05-21T21:08:00.000Z',
    reviewedNabatableValueHash: `${fieldKey}:nabatable`,
    reviewedGoogleValueHash: `${fieldKey}:google`,
  };
}

describe('google business profile workflow draft state helpers', () => {
  it('summarizes changed sections and blocked Nabatable updates', () => {
    const section = summarizeSection('profile', 'Profile', [
      buildItem('profile.name', { selected: true }),
      buildItem('profile.address', {
        label: 'Address',
        canPublishToNabatable: false,
      }),
    ]);

    expect(section.status).toBe('ready');
    expect(section.summary).toBe('2 changes ready to review.');
    expect(section.canPublishToNabatable).toBe(true);
    expect(section.blockedReasons).toEqual([
      'Address cannot be updated in Nabatable from this review yet.',
    ]);
  });

  it('derives selected approvals from reviewer decisions', () => {
    expect(
      selectedApprovalsFromDecisions([
        buildDecision('profile.name', 'import_from_google'),
        buildDecision('profile.address', 'ignore'),
      ]),
    ).toEqual({
      'profile.name': true,
      'profile.address': false,
    });
  });

  it('applies selections, upgrades older draft items, and blocks stale sections', () => {
    const section = buildSection('profile', [
      buildItem('profile.name', {
        selected: false,
        normalizedNabatableValue: undefined,
        normalizedGoogleValue: undefined,
      }),
    ]);

    const [updated] = applySelectedApprovals([section], { 'profile.name': true }, ['profile'], []);

    expect(updated.status).toBe('stale');
    expect(updated.canPublishToNabatable).toBe(false);
    expect(updated.items[0].selected).toBe(true);
    expect(updated.items[0].capabilities).toEqual({
      canImportFromGoogle: true,
      canExportToGoogle: true,
      canIgnore: true,
    });
    expect(updated.items[0].nabatableValueHash).toEqual(expect.any(String));
  });

  it('reconciles stale drafts against current sections', () => {
    const draft: Draft = {
      status: 'stale',
      staleSections: ['profile', 'operatingHours'],
      selectedApprovals: { 'profile.name': true },
      decisions: [],
      sectionDiffs: [],
    };
    const reconciled = reconcileDraftWithCurrentSections(draft, [
      buildSection('profile', [buildItem('profile.name', { selected: false })]),
      buildSection('operatingHours', [
        buildItem('operatingHours.weekly.1', {
          sectionKey: 'operatingHours',
          status: 'unchanged',
          currentValue: 'Closed',
          providerValue: 'Closed',
        }),
      ]),
    ]);

    expect(reconciled.staleSections).toEqual(['profile']);
    expect(reconciled.sectionDiffs[0].status).toBe('stale');
    expect(reconciled.sectionDiffs[0].canPublishToNabatable).toBe(false);
    expect(reconciled.sectionDiffs[1].status).toBe('unchanged');
  });

  it('suppresses selections and actions for read-only review states', () => {
    const draft: Draft = {
      status: 'published',
      staleSections: ['profile'],
      selectedApprovals: { 'profile.name': true },
      decisions: [buildDecision('profile.name', 'import_from_google')],
      sectionDiffs: [buildSection('profile', [buildItem('profile.name', { selected: true })])],
    };

    const readOnly = suppressActionsForReadOnlyReview(draft);

    expect(readOnly.selectedApprovals).toEqual({ 'profile.name': false });
    expect(readOnly.decisions).toEqual([]);
    expect(readOnly.staleSections).toEqual([]);
    expect(readOnly.sectionDiffs[0].status).toBe('unchanged');
    expect(readOnly.sectionDiffs[0].items[0].selected).toBe(false);
  });
});
