import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DualSyncReviewSectionFields } from '@/components/features/restaurant-settings/dual-sync/DualSyncReviewSectionFields';

import { makeDualSyncFieldSummary } from '../testUtils';

import type {
  DualSyncReviewSectionFieldRowModel,
  DualSyncReviewSectionState,
} from '@/components/features/restaurant-settings/dual-sync/dualSyncReviewSectionDomain';

const sectionState = {
  emptyMessage: 'Everything in this section matches Google.',
} as unknown as DualSyncReviewSectionState;

describe('DualSyncReviewSectionFields', () => {
  it('@contract shows the section empty message without rows', () => {
    render(
      <DualSyncReviewSectionFields
        sectionState={sectionState}
        rows={[]}
        writeBlocked={false}
        onSelectAction={vi.fn()}
      />,
    );

    expect(screen.getByText('Everything in this section matches Google.')).toBeInTheDocument();
  });

  it('@contract renders a field row per model and routes action changes by field key', async () => {
    const user = userEvent.setup();
    const onSelectAction = vi.fn();
    const rows = [
      {
        field: makeDualSyncFieldSummary(),
        selectedAction: null,
      },
    ] as unknown as ReadonlyArray<DualSyncReviewSectionFieldRowModel>;
    render(
      <DualSyncReviewSectionFields
        sectionState={sectionState}
        rows={rows}
        writeBlocked={false}
        onSelectAction={onSelectAction}
      />,
    );

    expect(screen.getByText('Business name')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Use Google’s' }));
    expect(onSelectAction).toHaveBeenCalledWith('profile.name', 'import_from_google');
  });
});
