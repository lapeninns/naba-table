import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { GbpExactPublishResultDialog } from '@/components/features/restaurant-settings/dual-sync/GbpExactPublishResultDialog';

describe('GbpExactPublishResultDialog', () => {
  it('shows both fresh-preview and operational-delivery recovery for outcome_unknown', () => {
    render(
      <GbpExactPublishResultDialog
        open
        result={{
          mode: 'immediate',
          bundleId: 'bundle_1',
          grantIds: ['grant_1'],
          outcomes: [
            {
              groupId: 'group_1',
              status: 'outcome_unknown',
              reasonCode: 'provider_outcome_unknown',
            },
          ],
        }}
        onOpenChange={vi.fn()}
      />,
    );

    expect(
      screen.getByText(/refresh google state, verify the listing, and create a new preview/i),
    ).toBeInTheDocument();
    expect(screen.getByText('Outcome unknown')).toBeInTheDocument();
    expect(screen.queryByText('Confirmed by Google')).not.toBeInTheDocument();
    expect(screen.getByText('provider_outcome_unknown')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to review' })).toBeInTheDocument();
    expect(screen.getByText(/verify the operational notification channel/i)).toBeInTheDocument();
    expect(screen.getByText(/queued is not complete/i).parentElement).toHaveClass(
      'pr-12',
      'sm:pr-0',
    );
  });
});
