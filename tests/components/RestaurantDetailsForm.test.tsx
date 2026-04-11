import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RestaurantDetailsForm } from '../../components/ops/restaurants/RestaurantDetailsForm';

describe('RestaurantDetailsForm manager notification phone', () => {
  const initialValues = {
    name: 'Old Crown Girton',
    slug: 'old-crown-girton',
    timezone: 'Europe/London',
    contactEmail: 'ops@oldcrowngirton.example',
    contactPhone: '+44 1223 277217',
    address: '1 High Street',
    managerDailySummaryEnabled: false,
    managerNotificationPhone: '+441223277217',
    googleMapUrl: null,
    googleReviewUrl: null,
    bookingPolicy: null,
    reservationIntervalMinutes: 15,
    reservationDefaultDurationMinutes: 90,
    reservationLastSeatingBufferMinutes: 15,
    reservationLifecycleGraceMinutes: 15,
  } satisfies Parameters<typeof RestaurantDetailsForm>[0]['initialValues'];

  it('submits a valid manager notification number', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(<RestaurantDetailsForm initialValues={initialValues} onSubmit={onSubmit} />);
    const managerNumberInput = screen.getByRole('textbox', {
      name: /manager notification number/i,
    });

    await user.clear(managerNumberInput);
    await user.type(managerNumberInput, '+447700900000');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        managerNotificationPhone: '+447700900000',
      }),
    );
  });

  it('submits the manager daily summary toggle', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(<RestaurantDetailsForm initialValues={initialValues} onSubmit={onSubmit} />);

    await user.click(screen.getByRole('switch', { name: /daily manager sms summary/i }));
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        managerDailySummaryEnabled: true,
      }),
    );
  });

  it('blocks invalid manager notification numbers', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(<RestaurantDetailsForm initialValues={initialValues} onSubmit={onSubmit} />);
    const managerNumberInput = screen.getByRole('textbox', {
      name: /manager notification number/i,
    });

    await user.clear(managerNumberInput);
    await user.type(managerNumberInput, '07700900000');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/use e\.164 format/i)).toBeInTheDocument();
  });

  it('requires a manager number when the daily SMS toggle is enabled', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(<RestaurantDetailsForm initialValues={initialValues} onSubmit={onSubmit} />);

    await user.clear(
      screen.getByRole('textbox', {
        name: /manager notification number/i,
      }),
    );
    await user.click(screen.getByRole('switch', { name: /daily manager sms summary/i }));
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByText(/add a manager number before enabling daily sms summaries/i),
    ).toBeInTheDocument();
  });
});
