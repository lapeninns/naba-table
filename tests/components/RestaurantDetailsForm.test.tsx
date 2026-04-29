import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mutateAsyncMock = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/ops/useOpsRestaurantDetails', () => ({
  useOpsUpdateRestaurantDetails: () => ({
    mutateAsync: mutateAsyncMock,
    isPending: false,
  }),
}));

import {
  BookingRulesSubform,
  BrandIdentitySubform,
  ContactLocationSubform,
  ManagerNotificationsSubform,
  type RestaurantDetailsFormValues,
} from '../../components/ops/restaurants/RestaurantDetailsForm';

describe('RestaurantDetailsForm subforms', () => {
  const initialValues = {
    name: 'Old Crown Girton',
    slug: 'old-crown-girton',
    timezone: 'Europe/London',
    contactEmail: 'ops@oldcrowngirton.example',
    contactPhone: '+44 1223 277217',
    address: '1 High Street',
    businessDescription: null,
    managerDailySummaryEnabled: false,
    managerNotificationPhone: '+441223277217',
    googleMapUrl: 'https://maps.google.com/demo-venue',
    googleReviewUrl: 'https://g.page/demo-venue/review',
    bookingPolicy: null,
    reservationIntervalMinutes: 15,
    reservationDefaultDurationMinutes: 90,
    reservationLastSeatingBufferMinutes: 15,
    reservationLifecycleGraceMinutes: 15,
  } satisfies RestaurantDetailsFormValues;

  beforeEach(() => {
    mutateAsyncMock.mockReset();
    mutateAsyncMock.mockResolvedValue(initialValues);
  });

  it('saves brand and identity fields as a partial payload', async () => {
    const user = userEvent.setup();
    const onDirtyChange = vi.fn();

    render(
      <BrandIdentitySubform
        restaurantId="rest-1"
        initialValues={initialValues}
        onDirtyChange={onDirtyChange}
      />,
    );

    await user.type(
      screen.getByRole('textbox', { name: /business description/i }),
      '  Family friendly pub and Nepalese dining.  ',
    );
    await user.click(screen.getByRole('button', { name: /save brand & identity/i }));

    await waitFor(() =>
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        name: 'Old Crown Girton',
        businessDescription: 'Family friendly pub and Nepalese dining.',
      }),
    );
    expect(onDirtyChange).toHaveBeenCalledWith(true);
  });

  it('saves contact and location fields without booking rules', async () => {
    const user = userEvent.setup();

    render(<ContactLocationSubform restaurantId="rest-1" initialValues={initialValues} />);

    await user.clear(screen.getByRole('textbox', { name: /contact phone/i }));
    await user.type(screen.getByRole('textbox', { name: /contact phone/i }), '+447700900000');
    await user.click(screen.getByRole('button', { name: /save contact details/i }));

    await waitFor(() =>
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        timezone: 'Europe/London',
        contactEmail: 'ops@oldcrowngirton.example',
        contactPhone: '+447700900000',
        address: '1 High Street',
        googleMapUrl: 'https://maps.google.com/demo-venue',
        googleReviewUrl: 'https://g.page/demo-venue/review',
      }),
    );
    expect(mutateAsyncMock.mock.calls[0][0]).not.toHaveProperty('bookingPolicy');
    expect(mutateAsyncMock.mock.calls[0][0]).not.toHaveProperty('reservationIntervalMinutes');
  });

  it('saves manager notification fields and validates E.164 numbers', async () => {
    const user = userEvent.setup();

    render(<ManagerNotificationsSubform restaurantId="rest-1" initialValues={initialValues} />);

    await user.clear(screen.getByRole('textbox', { name: /manager notification number/i }));
    await user.type(
      screen.getByRole('textbox', { name: /manager notification number/i }),
      '07700900000',
    );
    await user.click(screen.getByRole('button', { name: /save notifications/i }));

    expect(mutateAsyncMock).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/use e\.164 format/i);

    await user.clear(screen.getByRole('textbox', { name: /manager notification number/i }));
    await user.type(
      screen.getByRole('textbox', { name: /manager notification number/i }),
      '+447700900000',
    );
    await user.click(screen.getByRole('switch', { name: /daily manager sms summary/i }));
    await user.click(screen.getByRole('button', { name: /save notifications/i }));

    await waitFor(() =>
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        managerNotificationPhone: '+447700900000',
        managerDailySummaryEnabled: true,
      }),
    );
  });

  it('saves booking rules from the availability subform', async () => {
    const user = userEvent.setup();

    render(<BookingRulesSubform restaurantId="rest-1" initialValues={initialValues} />);

    await user.clear(screen.getByRole('spinbutton', { name: /reservation interval/i }));
    await user.type(screen.getByRole('spinbutton', { name: /reservation interval/i }), '30');
    await user.type(
      screen.getByRole('textbox', { name: /booking policy/i }),
      '  Cancel up to 24 hours before arrival.  ',
    );
    await user.click(screen.getByRole('button', { name: /save booking rules/i }));

    await waitFor(() =>
      expect(mutateAsyncMock).toHaveBeenCalledWith({
        bookingPolicy: 'Cancel up to 24 hours before arrival.',
        reservationIntervalMinutes: 30,
        reservationDefaultDurationMinutes: 90,
        reservationLastSeatingBufferMinutes: 15,
        reservationLifecycleGraceMinutes: 15,
      }),
    );
  });

  it('shows GBP match badges on brand and contact subforms', () => {
    render(
      <>
        <BrandIdentitySubform
          restaurantId="rest-1"
          initialValues={{ ...initialValues, businessDescription: 'Family friendly pub' }}
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
            businessDescription: {
              status: 'verified',
              canPull: true,
              canPush: false,
              providerValue: 'Family friendly pub',
              googleManaged: false,
              tooltipTitle: 'Google Business Profile',
              tooltipLines: ['GBP description: Family friendly pub'],
              tooltipFooter: null,
            },
          }}
        />
        <ContactLocationSubform
          restaurantId="rest-1"
          initialValues={initialValues}
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
              providerValue: 'https://maps.google.com/demo-venue/',
              googleManaged: true,
              tooltipTitle: 'Google Business Profile',
              tooltipLines: ['GBP Maps URL: https://maps.google.com/demo-venue'],
              tooltipFooter: null,
            },
            googleReviewUrl: {
              status: 'verified',
              canPull: true,
              canPush: false,
              providerValue: 'https://g.page/demo-venue/review/',
              googleManaged: true,
              tooltipTitle: 'Google Business Profile',
              tooltipLines: ['GBP review URL: https://g.page/demo-venue/review'],
              tooltipFooter: null,
            },
          }}
        />
      </>,
    );

    expect(screen.getAllByText(/matches gbp/i)).toHaveLength(5);
  });
});
