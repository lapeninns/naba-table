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

  it('shows a GBP match badge when a core field matches the synced GBP value', async () => {
    const user = userEvent.setup();

    render(
      <RestaurantDetailsForm
        initialValues={initialValues}
        onSubmit={vi.fn()}
        gbpFieldVerifications={{
          name: {
            status: 'verified',
            canPull: true,
            canPush: true,
            providerValue: 'Old Crown Girton',
            googleManaged: false,
            tooltipTitle: 'Google Business Profile',
            tooltipLines: ['GBP name: Old Crown Girton'],
            tooltipFooter: null,
          },
        }}
      />,
    );

    expect(screen.getByText(/matches gbp/i)).toBeInTheDocument();

    await user.clear(screen.getByRole('textbox', { name: /restaurant name/i }));
    await user.type(screen.getByRole('textbox', { name: /restaurant name/i }), 'Different Name');

    expect(screen.queryByText(/matches gbp/i)).not.toBeInTheDocument();
  });

  it('normalizes phone and URL comparisons before showing GBP match badges', () => {
    render(
      <RestaurantDetailsForm
        initialValues={{
          ...initialValues,
          googleMapUrl: 'https://maps.google.com/demo-venue/',
          googleReviewUrl: 'https://g.page/demo-venue/review/',
        }}
        onSubmit={vi.fn()}
        gbpFieldVerifications={{
          contactPhone: {
            status: 'verified',
            canPull: true,
            canPush: true,
            providerValue: '+441223277217',
            googleManaged: false,
            tooltipTitle: 'Google Business Profile',
            tooltipLines: ['GBP phone: +441223277217'],
            tooltipFooter: null,
          },
          googleMapUrl: {
            status: 'verified',
            canPull: true,
            canPush: false,
            providerValue: 'https://maps.google.com/demo-venue',
            googleManaged: true,
            tooltipTitle: 'Google Business Profile',
            tooltipLines: ['GBP Maps URL: https://maps.google.com/demo-venue'],
            tooltipFooter: null,
          },
          googleReviewUrl: {
            status: 'verified',
            canPull: true,
            canPush: false,
            providerValue: 'https://g.page/demo-venue/review',
            googleManaged: true,
            tooltipTitle: 'Google Business Profile',
            tooltipLines: ['GBP review URL: https://g.page/demo-venue/review'],
            tooltipFooter: null,
          },
        }}
      />,
    );

    expect(screen.getAllByText(/matches gbp/i)).toHaveLength(3);
  });
});
