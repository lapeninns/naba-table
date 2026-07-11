import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DualSyncPublishWarningsAlert } from '@/components/features/restaurant-settings/dual-sync/DualSyncPublishWarningsAlert';

import type { DualSyncPlanWarning } from '@/server/dual-sync/publish/types';

describe('DualSyncPublishWarningsAlert', () => {
  it('@contract renders nothing without warnings', () => {
    const { container } = render(<DualSyncPublishWarningsAlert warnings={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('@contract lists each warning with its formatted label', () => {
    const warnings = [
      {
        code: 'destructive_write',
        message: 'This clears the published phone number.',
        groupId: 'group-1',
      },
    ] as unknown as ReadonlyArray<DualSyncPlanWarning>;
    render(<DualSyncPublishWarningsAlert warnings={warnings} />);

    expect(screen.getByText('High-risk publish review')).toBeInTheDocument();
    expect(screen.getByText(/This clears the published phone number\./)).toBeInTheDocument();
  });
});
