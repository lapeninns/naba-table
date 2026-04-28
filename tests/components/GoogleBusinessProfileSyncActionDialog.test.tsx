import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PreflightReviewDialog } from '@/components/features/restaurant-settings/google-business-profile/components/PreflightReviewDialog';
import { PublishPasswordDialog } from '@/components/features/restaurant-settings/google-business-profile/components/PublishPasswordDialog';

import type { GoogleBusinessProfileDraftItem } from '@/services/ops/restaurants';

const selectedItems: Array<GoogleBusinessProfileDraftItem & { sectionLabel: string }> = [
  {
    fieldKey: 'profile.name',
    label: 'Business name',
    sectionKey: 'profile',
    currentValue: 'Old value',
    providerValue: 'New value',
    proposedValue: 'New value',
    direction: 'pull_from_gbp',
    status: 'ready',
    selected: true,
    canPublishToNabatable: true,
    canPushToGoogle: true,
    warnings: [],
    sectionLabel: 'Profile',
  },
];

describe('PublishPasswordDialog', () => {
  it('requires a password before confirming', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <PublishPasswordDialog
        open
        onOpenChange={vi.fn()}
        title="Publish reviewed changes"
        description="Confirm the action."
        confirmLabel="Publish"
        onConfirm={onConfirm}
      />,
    );

    const confirmButton = screen.getByRole('button', { name: /^publish$/i });
    expect(confirmButton).toBeDisabled();

    await user.type(screen.getByLabelText(/confirm with your login password/i), 'secret');
    expect(confirmButton).toBeEnabled();

    await user.click(confirmButton);
    expect(onConfirm).toHaveBeenCalledWith('secret');
  });
});

describe('PreflightReviewDialog', () => {
  it('runs the final check and enables continue only when the backend says changes can be applied', async () => {
    const user = userEvent.setup();
    const onRunPreflight = vi.fn();
    const onContinue = vi.fn();

    const props = {
      open: true,
      onOpenChange: vi.fn(),
      direction: 'google_to_nabatable' as const,
      selectedItems,
      preflightErrorMessage: null,
      isPreflightPending: false,
      onRunPreflight,
      onContinue,
    };

    const { rerender } = render(<PreflightReviewDialog {...props} preflight={null} />);

    const continueButton = screen.getByRole('button', { name: /continue to apply/i });
    expect(continueButton).toBeDisabled();

    await user.click(screen.getByTestId('gbp-run-preflight-button'));
    expect(onRunPreflight).toHaveBeenCalled();

    rerender(
      <PreflightReviewDialog
        {...props}
        preflight={{
          publishJobId: 'job-1',
          idempotencyKey: 'key-1',
          mode: 'nabatable_only',
          directionIntent: 'google_to_nabatable',
          selectedApprovals: { 'profile.name': true },
          nabatableUpdates: selectedItems,
          pullOnlyItems: [],
          googleUpdateMasks: [],
          warnings: [],
          errors: [],
          canPublish: true,
          canPushToGoogle: false,
          activePublishJob: {
            id: 'job-1',
            draftId: 'draft-1',
            idempotencyKey: 'key-1',
            mode: 'nabatable_only',
            directionIntent: 'google_to_nabatable',
            status: 'preflight_ready',
            selectedApprovals: { 'profile.name': true },
            nabatableSections: ['profile'],
            googleUpdateMasks: [],
            postNabatableCoreHashes: {},
            errorClassification: null,
            errors: [],
            nabatableEventId: null,
            googleEventId: null,
            canRetryGooglePush: false,
            retryBlockedReason: 'N/A',
            createdAt: '2026-04-25T10:00:00.000Z',
            updatedAt: '2026-04-25T10:00:00.000Z',
          },
        }}
      />,
    );

    expect(continueButton).toBeEnabled();
    await user.click(continueButton);
    expect(onContinue).toHaveBeenCalled();
  });
});
