import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mutateAsyncMock = vi.hoisted(() => vi.fn());
const analyticsTrackMock = vi.hoisted(() => vi.fn());
const analyticsEmitMock = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/ops/useOpsRestaurantDetails', () => ({
  useOpsUpdateRestaurantDetails: () => ({
    mutateAsync: mutateAsyncMock,
    isPending: false,
  }),
}));
vi.mock('@/lib/analytics', () => ({
  track: analyticsTrackMock,
}));
vi.mock('@/lib/analytics/emit', () => ({
  emit: analyticsEmitMock,
}));

import {
  BookingRulesSubform,
  BrandIdentitySubform,
  ContactLocationSubform,
  ManagerNotificationsSubform,
  RestaurantDetailsForm,
  type RestaurantDetailsFormValues,
} from '../../components/ops/restaurants/RestaurantDetailsForm';
import {
  buildProfileCompletionAnalytics,
  buildTimezoneLabel,
  compareFieldValue,
  FIELD_TOOLTIPS,
  getGbpStatuses,
  mapInitialValues,
  pickDraftValues,
  sanitizePayload,
  validateRestaurantDetails,
} from '../../components/ops/restaurants/restaurantDetailsFormModel';

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
    analyticsTrackMock.mockReset();
    analyticsEmitMock.mockReset();
  });

  it('saves brand and identity fields as a partial payload', async () => {
    const user = userEvent.setup();
    const onDirtyChange = vi.fn();
    const onDraftChange = vi.fn();
    mutateAsyncMock.mockResolvedValueOnce({
      ...initialValues,
      businessDescription: 'Family friendly pub and Nepalese dining.',
      updatedAt: '2026-04-30T19:53:00.000Z',
    });

    render(
      <BrandIdentitySubform
        restaurantId="rest-1"
        initialValues={initialValues}
        formId="profile-brand-form"
        onDirtyChange={onDirtyChange}
        onDraftChange={onDraftChange}
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
    expect(onDraftChange).toHaveBeenCalledWith(
      {
        name: 'Old Crown Girton',
        businessDescription: '  Family friendly pub and Nepalese dining.  ',
      },
      true,
    );
    await waitFor(() => {
      expect(onDraftChange).toHaveBeenLastCalledWith({}, false);
      expect(onDirtyChange).toHaveBeenLastCalledWith(false);
    });
    expect(screen.getByRole('status')).toHaveTextContent('Brand and identity saved.');
    expect(screen.getByRole('status')).toHaveTextContent(/last updated/i);
    expect(analyticsTrackMock).toHaveBeenCalledWith(
      'restaurant_profile_section_saved',
      expect.objectContaining({
        restaurant_id: 'rest-1',
        section: 'brand_identity',
        changed_field_count: 1,
        changed_fields: ['businessDescription'],
        required_field_count: 3,
        completed_required_field_count: 3,
        required_fields_complete: true,
        profile_completion_score: 100,
        missing_profile_fields: [],
        saved_at: '2026-04-30T19:53:00.000Z',
      }),
    );
    expect(analyticsEmitMock).toHaveBeenCalledWith(
      'restaurant_profile_section_saved',
      expect.objectContaining({
        restaurant_id: 'rest-1',
        section: 'brand_identity',
      }),
    );
    expect(
      screen.getByRole('textbox', { name: /restaurant name/i }).closest('form'),
    ).toHaveAttribute('id', 'profile-brand-form');
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
    expect(screen.getByText('Use E.164 format such as +447700900000')).toBeInTheDocument();
    expect(screen.getByText(/fix the highlighted fields/i)).toBeInTheDocument();
    expect(analyticsTrackMock).toHaveBeenCalledWith(
      'restaurant_profile_validation_error',
      expect.objectContaining({
        restaurant_id: 'rest-1',
        section: 'manager_notifications',
        fields: ['managerNotificationPhone'],
      }),
    );

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

  it('shows required or optional status and why-it-matters helper copy on the full form', async () => {
    const user = userEvent.setup();

    render(<RestaurantDetailsForm initialValues={initialValues} onSubmit={vi.fn()} />);

    expect(screen.getAllByText('Required').length).toBeGreaterThanOrEqual(6);
    expect(screen.getAllByText('Optional').length).toBeGreaterThanOrEqual(8);
    expect(screen.getByText('Required if on')).toBeInTheDocument();
    expect(
      screen.getByText(
        /shown on the guest booking page, booking confirmations, and public-facing previews/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/public inbox for guest questions/i)).toBeInTheDocument();
    expect(screen.getByText(/public fallback number guests can trust/i)).toBeInTheDocument();
    expect(screen.getByText(/helps guests plan arrival/i)).toBeInTheDocument();
    expect(
      screen.getByText(/optional message shown to guests during booking/i),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /booking link/i }));
    expect(screen.getByText(/controls the public booking url/i)).toBeInTheDocument();
  });

  it('normalizes GBP comparisons and timezone labels in the form model', () => {
    expect(compareFieldValue('name', ' Old   Crown Girton ', 'old crown girton')).toBe(true);
    expect(compareFieldValue('contactPhone', '+44 1223 277217', '0044 1223 277217')).toBe(false);
    expect(compareFieldValue('contactPhone', '+44 1223 277217', '+44 (1223) 277217')).toBe(true);
    expect(
      compareFieldValue(
        'googleMapUrl',
        'https://maps.google.com/demo-venue/',
        'https://maps.google.com/demo-venue',
      ),
    ).toBe(true);
    expect(buildTimezoneLabel('Europe/London')).toMatch(/^London \(/);
    expect(FIELD_TOOLTIPS.googleMapUrl).toMatch(/directions/i);
  });

  it('derives GBP field statuses from local and provider values', () => {
    expect(
      getGbpStatuses(
        {
          name: initialValues.name,
          businessDescription: '',
          contactPhone: initialValues.contactPhone ?? '',
          address: initialValues.address ?? '',
          googleMapUrl: initialValues.googleMapUrl ?? '',
          googleReviewUrl: '',
        },
        {
          name: {
            status: 'verified',
            canPull: true,
            canPush: true,
            providerValue: 'Old Crown Girton',
            googleManaged: false,
            tooltipTitle: 'Google Business Profile',
            tooltipLines: [],
            tooltipFooter: null,
          },
          googleReviewUrl: {
            status: 'verified',
            canPull: true,
            canPush: false,
            providerValue: '',
            googleManaged: false,
            tooltipTitle: 'Google Business Profile',
            tooltipLines: [],
            tooltipFooter: null,
          },
        },
      ),
    ).toMatchObject({
      name: 'verified',
      businessDescription: 'unavailable',
      contactPhone: 'drifted',
      googleMapUrl: 'drifted',
      googleReviewUrl: 'unavailable',
    });
  });

  it('maps, validates, sanitizes, and summarizes restaurant detail form state', () => {
    const state = mapInitialValues({
      ...initialValues,
      contactEmail: null,
      contactPhone: null,
      address: null,
      businessDescription: '  Pub classics and Nepalese dishes.  ',
      bookingPolicy: null,
    });

    expect(state).toMatchObject({
      name: 'Old Crown Girton',
      contactEmail: '',
      reservationIntervalMinutes: '15',
      businessDescription: '  Pub classics and Nepalese dishes.  ',
    });
    expect(validateRestaurantDetails({ ...state, slug: 'Bad Slug' })).toMatchObject({
      slug: 'Booking link slug must contain only lowercase letters, numbers, and hyphens',
    });
    expect(
      sanitizePayload({
        ...state,
        contactEmail: ' ops@example.com ',
        contactPhone: ' +447700900000 ',
        bookingPolicy: ' Cancel 24 hours before arrival. ',
      }),
    ).toMatchObject({
      contactEmail: 'ops@example.com',
      contactPhone: '+447700900000',
      businessDescription: 'Pub classics and Nepalese dishes.',
      bookingPolicy: 'Cancel 24 hours before arrival.',
      emailSendReminder24h: true,
      emailSendReminderShort: true,
      emailSendReviewRequest: true,
    });
    expect(pickDraftValues(state, ['name', 'reservationIntervalMinutes'])).toEqual({
      name: 'Old Crown Girton',
      reservationIntervalMinutes: 15,
    });
    expect(buildProfileCompletionAnalytics({ ...initialValues, address: null })).toMatchObject({
      required_fields_complete: true,
      missing_profile_fields: ['businessDescription', 'address'],
    });
  });
});
