import { describe, expect, it } from 'vitest';

import {
  describeDualSyncDecisionOutcome,
  formatDualSyncDecisionSummary,
  getDualSyncReviewActionState,
  type DualSyncReviewActionStateInput,
} from '@/components/features/restaurant-settings/dual-sync/dualSyncReviewActionsDomain';

function input(
  overrides: Partial<DualSyncReviewActionStateInput> = {},
): DualSyncReviewActionStateInput {
  return {
    syncPaused: false,
    pauseReason: 'Paused for maintenance.',
    controlPending: false,
    refreshPending: false,
    autoExportPending: false,
    publishPending: false,
    previewPublishPending: false,
    importPending: false,
    canPublish: false,
    canImport: false,
    autoExportable: 0,
    summary: { toSend: 0, toImport: 0, ignored: 0 },
    ...overrides,
  };
}

describe('dualSyncReviewActionsDomain', () => {
  it('formats the choice summary and what each action will do', () => {
    const summary = { toSend: 2, toImport: 1, ignored: 3 };

    expect(formatDualSyncDecisionSummary(summary)).toBe(
      '2 to send · 1 to use from Google · 3 ignored',
    );
    expect(describeDualSyncDecisionOutcome(summary)).toBe(
      '1 value from Google will be saved in Nabatable only. 2 changes will go to Google after you confirm the exact plan.',
    );
    expect(describeDualSyncDecisionOutcome({ toSend: 0, toImport: 0, ignored: 1 })).toBe(
      'Nothing to publish to Google yet.',
    );
  });

  it('labels Review and publish and Use Google values with their counts', () => {
    const state = getDualSyncReviewActionState(
      input({ canPublish: true, canImport: true, summary: { toSend: 2, toImport: 3, ignored: 0 } }),
    );

    expect(state.publish).toMatchObject({ label: 'Review and publish (2)', disabled: false });
    expect(state.importValues).toMatchObject({
      visible: true,
      label: 'Use 3 Google values',
      disabled: false,
    });
    expect(state.refresh).toMatchObject({ label: 'Get latest from Google', disabled: false });
  });

  it('hides Use Google values without Use Google choices and explains a disabled publish', () => {
    const state = getDualSyncReviewActionState(input());

    expect(state.importValues.visible).toBe(false);
    expect(state.publish).toMatchObject({
      label: 'Review and publish',
      disabled: true,
      disabledHint: 'Choose Send to Google on at least one field to publish.',
    });
  });

  it('uses the pause reason while sync is paused', () => {
    const state = getDualSyncReviewActionState(
      input({ syncPaused: true, summary: { toSend: 1, toImport: 1, ignored: 0 } }),
    );

    expect(state.refresh).toMatchObject({
      disabled: true,
      disabledHint: 'Paused for maintenance.',
    });
    expect(state.publish.disabledHint).toBe('Paused for maintenance.');
    expect(state.importValues.disabledHint).toBe('Paused for maintenance.');
    expect(state.control.label).toBe('Resume sync');
    expect(state.autoExport.disabled).toBe(true);
  });

  it('shows running labels without claiming success', () => {
    const state = getDualSyncReviewActionState(
      input({
        publishPending: true,
        importPending: true,
        refreshPending: true,
        summary: { toSend: 1, toImport: 1, ignored: 0 },
      }),
    );

    expect(state.publish.label).toBe('Publishing…');
    expect(state.importValues.label).toBe('Saving…');
    expect(state.refresh).toMatchObject({ label: 'Getting latest…', disabled: true });
    expect(state.publish.disabledHint).toBe('Finish the running publish or preview first.');
  });
});
