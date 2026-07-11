import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DualSyncPublishPreviewDialogBody } from '@/components/features/restaurant-settings/dual-sync/DualSyncPublishPreviewDialogBody';

import type { DualSyncPublishPlan } from '@/server/dual-sync/publish/types';

const plan = {
  acceptedCount: 2,
  rejectedCount: 0,
  ignoredCount: 0,
  warnings: [],
  rejected: [],
  groups: [
    {
      groupId: 'group-1',
      sectionKey: 'profile',
      writeGroup: 'location.profile',
      direction: 'export',
      riskLevel: 'high',
      googleUpdateMasks: ['title'],
      fields: [{ fieldKey: 'profile.name' }],
    },
  ],
} as unknown as DualSyncPublishPlan;

describe('DualSyncPublishPreviewDialogBody', () => {
  it('@contract explains when no plan is loaded', () => {
    render(
      <DualSyncPublishPreviewDialogBody
        acknowledged={false}
        needsAcknowledgement={false}
        onAcknowledgedChange={vi.fn()}
        plan={null}
      />,
    );

    expect(screen.getByText('No publish plan loaded.')).toBeInTheDocument();
  });

  it('@contract renders the plan summary and groups without acknowledgement when not required', () => {
    render(
      <DualSyncPublishPreviewDialogBody
        acknowledged={false}
        needsAcknowledgement={false}
        onAcknowledgedChange={vi.fn()}
        plan={plan}
      />,
    );

    expect(screen.getByText('2 accepted')).toBeInTheDocument();
    expect(screen.getByText('location.profile')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('@contract requires the acknowledgement checkbox for high-risk plans', async () => {
    const user = userEvent.setup();
    const onAcknowledgedChange = vi.fn();
    render(
      <DualSyncPublishPreviewDialogBody
        acknowledged={false}
        needsAcknowledgement
        onAcknowledgedChange={onAcknowledgedChange}
        plan={plan}
      />,
    );

    await user.click(screen.getByRole('checkbox'));

    expect(onAcknowledgedChange).toHaveBeenCalledWith(true);
  });
});
