import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  buildSetupCards,
  summarizeReadiness,
  type BuildSetupCardsInput,
} from '@/components/features/restaurant-settings/overview/buildSetupCards';
import { SetupProgressPanel } from '@/components/features/restaurant-settings/overview/SetupProgressPanel';

const input: BuildSetupCardsInput = {
  profileChecks: { name: true, slug: true, timezone: true, contactPhone: true },
  openDays: 7,
  servicePeriodCount: 0,
  totalTables: 2,
  availableTables: 2,
  menuCount: 0,
  pendingInvites: 0,
};

describe('SetupProgressPanel', () => {
  it('@contract @a11y names the next step and labels the segmented progress bar', () => {
    render(<SetupProgressPanel readiness={summarizeReadiness(buildSetupCards(input))} />);

    expect(screen.getByRole('heading', { name: 'Not ready for bookings yet' })).toBeInTheDocument();
    expect(
      screen.getByText('2 of 3 required steps complete. Next: booking availability.'),
    ).toBeInTheDocument();
    const bar = screen.getByRole('img', { name: '2 of 3 required steps complete' });
    expect(Array.from(bar.children).map((segment) => segment.getAttribute('data-state'))).toEqual([
      'complete',
      'incomplete',
      'complete',
    ]);
    expect(screen.queryByRole('link', { name: 'Preview guest times' })).toBeNull();
  });

  it('@contract offers the guest-times preview only when ready', () => {
    render(
      <SetupProgressPanel
        readiness={summarizeReadiness(buildSetupCards({ ...input, servicePeriodCount: 3 }))}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Ready to take bookings' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Preview guest times' })).toHaveAttribute(
      'href',
      '/app/settings/restaurant/availability',
    );
  });
});
