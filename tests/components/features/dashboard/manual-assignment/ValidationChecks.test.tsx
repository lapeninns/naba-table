import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { ValidationChecks } from '@/components/features/dashboard/manual-assignment/ValidationChecks';

import type { ManualSelectionCheck } from '@/services/ops/bookings';

function makeChecks(): ManualSelectionCheck[] {
  return [
    { id: 'capacity', status: 'error', message: 'Selected tables seat fewer than the party.' },
    { id: 'sameZone', status: 'warn', message: 'Tables span multiple zones.' },
    { id: 'conflict', status: 'ok', message: 'No overlapping holds.', details: { holds: 0 } },
  ];
}

describe('ValidationChecks', () => {
  it('@contract renders nothing when there are no checks', () => {
    const { container } = render(<ValidationChecks checks={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('@contract summarizes error and warning counts in the header', () => {
    render(<ValidationChecks checks={makeChecks()} />);

    expect(screen.getByText('Validation Results')).toBeInTheDocument();
    expect(screen.getByText('1 error')).toBeInTheDocument();
    expect(screen.getByText('1 warning')).toBeInTheDocument();
    expect(screen.queryByText('All checks passed')).not.toBeInTheDocument();
  });

  it('@contract shows the all-clear label when every check passes', () => {
    render(
      <ValidationChecks
        checks={[{ id: 'movable', status: 'ok', message: 'All selected tables are movable.' }]}
      />,
    );

    expect(screen.getByText('All checks passed')).toBeInTheDocument();
  });

  it('@contract expands to the per-check detail rows', async () => {
    const user = userEvent.setup();
    render(<ValidationChecks checks={makeChecks()} />);

    const toggle = screen.getByRole('button', { name: 'Expand validation details' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggle);

    expect(
      screen.getByRole('button', { name: 'Collapse validation details' }),
    ).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Capacity Requirements')).toBeInTheDocument();
    expect(screen.getByText('Zone Compatibility')).toBeInTheDocument();
    expect(screen.getByText('Availability Check')).toBeInTheDocument();
    expect(screen.getByText('Selected tables seat fewer than the party.')).toBeInTheDocument();
    expect(screen.getByText(/"holds": 0/)).toBeInTheDocument();
  });
});
