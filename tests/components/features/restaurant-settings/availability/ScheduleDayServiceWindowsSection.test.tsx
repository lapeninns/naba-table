import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ScheduleDayServiceWindowsSection } from '@/components/features/restaurant-settings/availability/ScheduleDayServiceWindowsSection';

function renderSection() {
  const handlers = { onMealTimeChange: vi.fn(), onMealToggle: vi.fn() };
  render(
    <ScheduleDayServiceWindowsSection
      dayOfWeek={2}
      lunchEditor={{
        disabled: false,
        errors: undefined,
        meal: { enabled: true, startTime: '12:00', endTime: '15:00' },
      }}
      dinnerEditor={{
        disabled: false,
        errors: undefined,
        meal: { enabled: false, startTime: '', endTime: '' },
      }}
      {...handlers}
    />,
  );
  return handlers;
}

describe('ScheduleDayServiceWindowsSection', () => {
  it('@smoke renders lunch and dinner editors under the service windows heading', () => {
    renderSection();

    expect(screen.getByText(/Service windows \(Lunch \/ Dinner Sessions\)/)).toBeInTheDocument();
    expect(screen.getByText('Lunch')).toBeInTheDocument();
    expect(screen.getByText('Dinner')).toBeInTheDocument();
  });

  it('@contract routes meal toggles with the day and meal key', async () => {
    const user = userEvent.setup();
    const { onMealToggle } = renderSection();

    const dinner = screen.getByText('Dinner').closest('div[class*="rounded-lg"]') as HTMLElement;
    await user.click(within(dinner).getByRole('switch', { name: 'Active' }));

    expect(onMealToggle).toHaveBeenCalledWith(2, 'dinner', true);
  });
});
