import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Store } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';

import { SetupChecklistCard } from '@/components/features/restaurant-settings/overview/SetupChecklistCard';

import type { SetupCard } from '@/components/features/restaurant-settings/overview/buildSetupCards';

function makeCard(over: Partial<SetupCard> = {}): SetupCard {
  return {
    key: 'profile',
    group: 'required',
    title: 'Public profile',
    reason: 'Guests see this on the booking page and in confirmations.',
    status: 'attention',
    cta: 'Open profile',
    href: '/app/settings/restaurant/profile',
    checks: [
      { label: 'Restaurant name', ok: true },
      { label: 'Public phone', ok: false },
    ],
    Icon: Store,
    ...over,
  };
}

function renderRow(ui: React.ReactElement) {
  return render(<ul>{ui}</ul>);
}

describe('SetupChecklistCard', () => {
  it('@smoke renders status badge, reason, what was checked and the CTA link', () => {
    renderRow(<SetupChecklistCard card={makeCard()} isNextStep />);

    const row = screen.getByRole('listitem', { name: /Public profile/ });
    expect(within(row).getByText('Needs attention')).toBeInTheDocument();
    expect(
      within(row).getByText('Guests see this on the booking page and in confirmations.'),
    ).toBeInTheDocument();
    const checks = within(row).getByRole('list', { name: 'What was checked' });
    expect(within(checks).getAllByRole('listitem')).toHaveLength(2);
    expect(within(checks).getByText('Missing:')).toHaveClass('sr-only');
    expect(within(row).getByRole('link', { name: 'Open profile' })).toHaveAttribute(
      'href',
      '/app/settings/restaurant/profile',
    );
  });

  it('@contract labels complete and optional statuses distinctly', () => {
    renderRow(
      <>
        <SetupChecklistCard card={makeCard({ key: 'tables', status: 'complete' })} />
        <SetupChecklistCard card={makeCard({ key: 'menu', status: 'optional', checks: [] })} />
      </>,
    );

    expect(screen.getByText('Complete')).toBeInTheDocument();
    expect(screen.getByText('Optional')).toBeInTheDocument();
  });

  it('@contract replaces the CTA with "Check again" when the check could not run', async () => {
    const user = userEvent.setup();
    const onCheckAgain = vi.fn();
    renderRow(
      <SetupChecklistCard
        card={makeCard({ status: 'unknown', checks: [] })}
        onCheckAgain={onCheckAgain}
      />,
    );

    expect(screen.getByText('Couldn’t check')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open profile' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Check again' }));
    expect(onCheckAgain).toHaveBeenCalledTimes(1);
  });

  it('@a11y disables the retry and says so while checking', () => {
    renderRow(
      <SetupChecklistCard
        card={makeCard({ status: 'unknown', checks: [] })}
        onCheckAgain={vi.fn()}
        isChecking
      />,
    );

    expect(screen.getByRole('button', { name: 'Checking…' })).toBeDisabled();
  });
});
