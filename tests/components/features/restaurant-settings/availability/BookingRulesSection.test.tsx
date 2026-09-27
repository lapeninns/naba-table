import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { BookingRulesSection } from '@/components/features/restaurant-settings/availability/BookingRulesSection';

import type { BookingRulesDraft } from '@/components/features/restaurant-settings/availability/availabilityPageDraft';
import type { AvailabilityErrors } from '@/components/features/restaurant-settings/availability/availabilityPageValidation';

const RULES: BookingRulesDraft = {
  reservationIntervalMinutes: '15',
  reservationLastSeatingBufferMinutes: '15',
  reservationDefaultDurationMinutes: '90',
  reservationLifecycleGraceMinutes: '15',
  bookingPolicy: 'Tables are held for 15 minutes.',
};

function renderSection(errors: AvailabilityErrors = {}) {
  const onChange = vi.fn();
  render(
    <BookingRulesSection
      rules={RULES}
      weeklyRows={[]}
      edited={false}
      errors={errors}
      onChange={onChange}
      onTouch={vi.fn()}
    />,
  );
  return { onChange };
}

describe('BookingRulesSection', () => {
  it('@responsive leaves no hidden grace or policy field laid out while the disclosure is closed', () => {
    renderSection();

    // A closed <details> still lays its children out in Chromium, over the cards below it.
    expect(screen.queryByLabelText(/Booking policy shown to guests/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Late grace period')).not.toBeInTheDocument();
  });

  it('@contract shows and edits the policy once the disclosure is opened', async () => {
    const user = userEvent.setup();
    const { onChange } = renderSection();

    await user.click(screen.getByText('Late grace period and booking policy'));

    const policy = screen.getByLabelText(/Booking policy shown to guests/);
    expect(policy).toHaveValue(RULES.bookingPolicy);
    await user.type(policy, '!');
    expect(onChange).toHaveBeenLastCalledWith({ bookingPolicy: `${RULES.bookingPolicy}!` });
  });

  it('@a11y opens the disclosure when the grace period has an error, so it can be focused', () => {
    renderSection({ 'r-grace': 'From 0 to 120 minutes.' });

    expect(screen.getByLabelText('Late grace period')).toBeInTheDocument();
    expect(screen.getByText('From 0 to 120 minutes.')).toBeInTheDocument();
  });

  it('@responsive pairs its fields by the card width, not the viewport', () => {
    renderSection();

    const interval = screen.getByLabelText('Time between booking slots');
    expect(interval.closest('.grid')).toHaveClass('@xl:grid-cols-2');
    expect(interval.closest('.grid')).not.toHaveClass('md:grid-cols-2');
  });
});
