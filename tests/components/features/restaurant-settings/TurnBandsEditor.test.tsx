import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TurnBandsEditor } from '@/components/features/restaurant-settings/TurnBandsEditor';

import type { TurnBandInput } from '@/services/ops/restaurants';

const bands: TurnBandInput[] = [
  { maxPartySize: 2, durationMinutes: 60 },
  { maxPartySize: 6, durationMinutes: 120 },
];

describe('TurnBandsEditor', () => {
  it('@smoke shows the defaults alert when no overrides exist', () => {
    render(<TurnBandsEditor bands={[]} onChange={vi.fn()} fallbackLabel="Defaults to 90 min." />);

    expect(screen.getByText('Defaults in use')).toBeInTheDocument();
    expect(screen.getByText('Defaults to 90 min.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear overrides' })).not.toBeInTheDocument();
  });

  it('@contract adds a band seeded from the last row when Add band is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TurnBandsEditor bands={bands} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Add band' }));

    expect(onChange).toHaveBeenCalledWith([
      { maxPartySize: 2, durationMinutes: 60 },
      { maxPartySize: 6, durationMinutes: 120 },
      { maxPartySize: 8, durationMinutes: 120 },
    ]);
  });

  it('@contract updates a row when its duration is edited', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TurnBandsEditor bands={[{ maxPartySize: 2, durationMinutes: 60 }]} onChange={onChange} />);

    const duration = screen.getByLabelText('Duration in minutes');
    await user.type(duration, '5');

    expect(onChange).toHaveBeenLastCalledWith([{ maxPartySize: 2, durationMinutes: 605 }]);
  });

  it('@contract removes a row via its Remove band action', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<TurnBandsEditor bands={bands} onChange={onChange} />);

    await user.click(screen.getAllByRole('button', { name: 'Remove band' })[0]);

    expect(onChange).toHaveBeenCalledWith([{ maxPartySize: 6, durationMinutes: 120 }]);
  });

  it('@contract applies defaults and clears overrides through the secondary actions', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const defaults: TurnBandInput[] = [{ maxPartySize: 4, durationMinutes: 75 }];
    const { rerender } = render(
      <TurnBandsEditor bands={[]} defaults={defaults} onChange={onChange} />,
    );

    await user.click(screen.getByRole('button', { name: 'Use defaults' }));
    expect(onChange).toHaveBeenCalledWith(defaults);

    rerender(<TurnBandsEditor bands={bands} defaults={defaults} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: 'Clear overrides' }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('@contract renders row errors and disables inputs when disabled', () => {
    render(
      <TurnBandsEditor
        bands={[{ maxPartySize: 2, durationMinutes: 60 }]}
        errors={[{ maxPartySize: 'Must be unique', durationMinutes: 'Too short' }]}
        onChange={vi.fn()}
        disabled
      />,
    );

    expect(screen.getByText('Must be unique')).toBeInTheDocument();
    expect(screen.getByText('Too short')).toBeInTheDocument();
    expect(screen.getByLabelText('Max party size')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add band' })).toBeDisabled();
  });
});
