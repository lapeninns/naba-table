import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DualSyncPublishPreviewDialog } from '@/components/features/restaurant-settings/dual-sync/DualSyncPublishPreviewDialog';

import type { DualSyncPublishPlan } from '@/server/dual-sync/publish/types';

function makePlan(over: Partial<DualSyncPublishPlan> = {}): DualSyncPublishPlan {
  return {
    restaurantId: 'restaurant-1',
    coreSnapshotHash: 'core-hash',
    gbpSnapshotHash: 'gbp-hash',
    acceptedCount: 2,
    rejectedCount: 0,
    ignoredCount: 0,
    groups: [
      {
        groupId: 'export_to_google:profile:location.profile',
        direction: 'export_to_google',
        sectionKey: 'profile',
        writeGroup: 'location.profile',
        fields: [
          {
            fieldKey: 'profile.phone',
            sectionKey: 'profile',
            action: 'export_to_google',
            pinnedCoreHash: 'core-phone',
            pinnedGbpHash: 'gbp-phone',
          },
          {
            fieldKey: 'profile.website',
            sectionKey: 'profile',
            action: 'export_to_google',
            pinnedCoreHash: 'core-website',
            pinnedGbpHash: 'gbp-website',
          },
        ],
        riskLevel: 'critical',
        requiresPreflight: true,
        requiresManualConfirmation: true,
        destructiveWritePossible: true,
        googleUpdateMasks: ['phoneNumbers'],
      },
    ],
    rejected: [],
    warnings: [
      {
        code: 'HIGH_RISK',
        groupId: 'export_to_google:profile:location.profile',
        message: 'profile includes high-risk fields that require manual confirmation.',
      },
    ],
    ...over,
  };
}

describe('DualSyncPublishPreviewDialog', () => {
  it('requires explicit acknowledgement before confirming high-risk publishes', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <DualSyncPublishPreviewDialog
        open
        plan={makePlan()}
        isPublishing={false}
        onOpenChange={vi.fn()}
        onConfirm={onConfirm}
      />,
    );

    const publishButton = screen.getByRole('button', { name: 'Publish 2 fields' });
    expect(publishButton).toBeDisabled();
    expect(screen.getByText('High-risk publish review')).toBeInTheDocument();
    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('location.profile')).toBeInTheDocument();

    await user.click(
      screen.getByRole('checkbox', {
        name: 'I understand this may update public Google Business Profile data.',
      }),
    );
    await user.click(publishButton);

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('shows rejected decisions and disables publish when nothing is accepted', () => {
    render(
      <DualSyncPublishPreviewDialog
        open
        plan={makePlan({
          acceptedCount: 0,
          rejectedCount: 1,
          groups: [],
          warnings: [],
          rejected: [
            {
              fieldKey: 'profile.googleMapUrl',
              sectionKey: 'profile',
              action: 'export_to_google',
              failure: {
                code: 'UNSUPPORTED_FIELD',
                message: 'Google-owned metadata is not directly writable.',
                retryable: false,
              },
            },
          ],
        })}
        isPublishing={false}
        onOpenChange={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByText('Rejected decisions')).toBeInTheDocument();
    expect(screen.getByText('profile.googleMapUrl')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish 0 fields' })).toBeDisabled();
  });
});
