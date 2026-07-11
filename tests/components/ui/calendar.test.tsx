import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Calendar } from '@/components/ui/calendar';

// Pinned month keeps the suite deterministic under any host date/TZ.
const JUNE_2026 = new Date(2026, 5, 1);

describe('ui/calendar', () => {
  it('@smoke renders the pinned month with a day grid', () => {
    render(<Calendar mode="single" defaultMonth={JUNE_2026} />);

    expect(screen.getByText('June 2026')).toBeInTheDocument();
    expect(screen.getAllByRole('grid').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /15/ })).toBeInTheDocument();
  });

  it('@contract selecting a day reports the date through onSelect', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<Calendar mode="single" defaultMonth={JUNE_2026} onSelect={onSelect} />);

    await user.click(screen.getByRole('button', { name: /15/ }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    const selected = onSelect.mock.calls[0][0] as Date;
    expect(selected.getFullYear()).toBe(2026);
    expect(selected.getMonth()).toBe(5);
    expect(selected.getDate()).toBe(15);
  });

  it('@contract month navigation buttons move to the adjacent month', async () => {
    const user = userEvent.setup();
    render(<Calendar mode="single" defaultMonth={JUNE_2026} />);

    await user.click(screen.getByRole('button', { name: /next month/i }));

    expect(screen.getByText('July 2026')).toBeInTheDocument();
  });
});
