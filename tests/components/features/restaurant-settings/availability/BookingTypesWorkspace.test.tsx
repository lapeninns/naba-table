import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { BookingTypesWorkspace } from '@/components/features/restaurant-settings/availability/BookingTypesWorkspace';

import type { OpsOccasion } from '@/services/ops/occasions';

const occasion = {
  key: 'lunch',
  label: 'Lunch',
  shortLabel: 'Lunch',
  description: null,
  defaultDurationMinutes: 90,
  displayOrder: 10,
  isActive: true,
  availability: [{ kind: 'anytime' }],
  isBuiltin: true,
} as OpsOccasion;

function renderWorkspace() {
  const handlers = { onOccasionsChange: vi.fn(), onTurnBandsChange: vi.fn() };
  render(
    <BookingTypesWorkspace
      occasionDrafts={[occasion]}
      turnBandsDraft={{}}
      turnBandDefaults={{}}
      turnBandErrors={{}}
      {...handlers}
    />,
  );
  return handlers;
}

describe('BookingTypesWorkspace', () => {
  it('@smoke explains booking types and renders the occasions editor', () => {
    renderWorkspace();

    expect(screen.getByText('Booking types control guest choices')).toBeInTheDocument();
    expect(screen.getByText('Turn times by party size')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New booking type' })).toBeInTheDocument();
    expect(screen.getAllByText('Lunch').length).toBeGreaterThan(0);
  });

  it('@contract jumps to booking rules via the inline anchor button', async () => {
    const user = userEvent.setup();
    const replaceStateSpy = vi.spyOn(window.history, 'replaceState');
    renderWorkspace();

    await user.click(screen.getByRole('button', { name: 'Booking rules' }));

    expect(replaceStateSpy).toHaveBeenCalledWith(null, '', expect.stringContaining('#'));
  });
});
