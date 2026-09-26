import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

import { type ProfileSubformProps } from '../../components/ops/restaurants/details/shared';
import {
  AdvancedIdentitySubform,
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
    managerWhatsappEnabled: false,
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
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'http://app.localhost:3000');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function profileProps(over: Partial<ProfileSubformProps> = {}): ProfileSubformProps {
    const state = mapInitialValues(initialValues);
    return {
      state,
      savedState: state,
      errors: {},
      onFieldChange: vi.fn(),
      onFieldBlur: vi.fn(),
      ...over,
    };
  }

  it('reports brand edits to the page draft and shows the description counter', async () => {
    const user = userEvent.setup();
    const props = profileProps({
      state: { ...mapInitialValues(initialValues), businessDescription: 'Village pub' },
    });

    render(<BrandIdentitySubform {...props} />);

    expect(screen.getByText(/11 \/ 4,096 characters/)).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: /business description/i }), '!');
    expect(props.onFieldChange).toHaveBeenCalledWith('businessDescription', 'Village pub!');
    await user.tab();
    expect(props.onFieldBlur).toHaveBeenCalledWith('businessDescription');
    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
  });

  it('shows a field error below the field, linked and marked invalid', () => {
    render(
      <BrandIdentitySubform
        {...profileProps({ errors: { name: 'Restaurant name is required' } })}
      />,
    );

    const name = screen.getByRole('textbox', { name: /restaurant name/i });
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(name).toHaveAttribute('aria-describedby', 'restaurant-name-error');
    expect(document.getElementById('restaurant-name-error')).toHaveTextContent(
      'Restaurant name is required',
    );
  });

  it('groups contact fields and labels the phone as needed before guests can book', () => {
    render(<ContactLocationSubform {...profileProps()} />);

    expect(screen.getByText('Location')).toBeInTheDocument();
    expect(screen.getByText('Public contact')).toBeInTheDocument();
    expect(screen.getByText('After the visit')).toBeInTheDocument();
    expect(screen.getByText('Needed before guests can book')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /public phone/i })).toHaveValue('+44 1223 277217');
    expect(screen.getByRole('combobox', { name: /timezone/i })).toHaveTextContent(
      /^London \(GMT[+-]?\d*\) · Europe\/London$/,
    );
    expect(screen.getByText('Used in review-request emails.')).toBeInTheDocument();
  });

  it('previews the booking page link and copies the saved link', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(<AdvancedIdentitySubform {...profileProps()} />);

    expect(screen.getByRole('textbox', { name: /link name/i })).toHaveValue('old-crown-girton');
    expect(screen.getByText('Guests book at')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Copy link' }));

    expect(writeText).toHaveBeenCalledWith(
      'http://localhost:3000/restaurants/old-crown-girton/book',
    );
  });

  it('shows the new booking page link beside the current one until it is saved', () => {
    const saved = mapInitialValues(initialValues);
    render(
      <AdvancedIdentitySubform
        {...profileProps({ state: { ...saved, slug: 'the-old-crown' }, savedState: saved })}
      />,
    );

    expect(
      screen.getByText('New link after you save. Guests keep using the old one until then.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('http://localhost:3000/restaurants/the-old-crown/book'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('http://localhost:3000/restaurants/old-crown-girton/book'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeDisabled();
  });

  it('explains why WhatsApp is unavailable and when the number change turned it off', () => {
    const saved = mapInitialValues(initialValues);
    const { rerender } = render(<ManagerNotificationsSubform {...profileProps()} />);

    expect(screen.getByRole('switch', { name: 'Try WhatsApp first' })).toBeDisabled();
    expect(screen.getByText('Turn on the daily summary first.')).toBeInTheDocument();

    rerender(
      <ManagerNotificationsSubform
        {...profileProps({
          state: { ...saved, managerDailySummaryEnabled: true, managerNotificationPhone: '' },
        })}
      />,
    );
    expect(screen.getByText('Add a manager alert number first.')).toBeInTheDocument();

    rerender(
      <ManagerNotificationsSubform
        {...profileProps({ state: { ...saved, managerDailySummaryEnabled: true } })}
        whatsappTurnedOff
      />,
    );
    expect(screen.getByRole('switch', { name: 'Try WhatsApp first' })).toBeEnabled();
    expect(
      screen.getByText('If WhatsApp can’t deliver, the summary goes by SMS.'),
    ).toBeInTheDocument();
    expect(screen.getByText('WhatsApp was turned off')).toBeInTheDocument();
  });

  it('shows GBP match badges on brand and contact subforms', () => {
    render(
      <>
        <BrandIdentitySubform
          {...profileProps({
            state: {
              ...mapInitialValues(initialValues),
              businessDescription: 'Family friendly pub',
            },
          })}
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
          {...profileProps()}
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

    expect(screen.getAllByText('Matches Google')).toHaveLength(5);
    expect(screen.getAllByRole('button', { name: 'Show the Google value' })).toHaveLength(5);
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
    await user.click(screen.getByRole('button', { name: /booking page url/i }));
    expect(screen.getByRole('textbox', { name: /booking page url/i })).toBeInTheDocument();
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
      slug: 'Booking page link must contain only lowercase letters, numbers, and hyphens',
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
