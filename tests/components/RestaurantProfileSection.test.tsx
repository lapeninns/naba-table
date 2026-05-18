import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const updateProfileMock = vi.hoisted(() => vi.fn());
const analyticsTrackMock = vi.hoisted(() => vi.fn());
const analyticsEmitMock = vi.hoisted(() => vi.fn());
const businessContextData = vi.hoisted(() => ({
  core: {
    businessDetails: null,
    links: [],
    categories: [],
    serviceAreas: [],
    attributes: [],
    serviceItems: [],
  },
  providerSnapshot: {
    businessDetails: null,
    links: [],
    categories: [],
    serviceAreas: [],
    attributes: [],
    serviceItems: [],
  },
}));
const gbpConnectionData = vi.hoisted(() => ({
  isConfigured: false,
  provider: 'google_business_profile',
  status: 'unlinked',
  businessInfo: null,
}));

vi.mock('next/image', () => ({
  default: () => null,
}));

vi.mock('@/contexts/ops-unsaved-changes', () => ({
  useRegisterOpsUnsavedChanges: vi.fn(),
}));

vi.mock('@/lib/analytics', () => ({
  track: analyticsTrackMock,
}));

vi.mock('@/lib/analytics/emit', () => ({
  emit: analyticsEmitMock,
}));

vi.mock('@/hooks/ops/useOpsGoogleBusinessProfile', () => ({
  useOpsGoogleBusinessProfileConnection: () => ({
    data: gbpConnectionData,
  }),
}));

vi.mock('@/hooks/ops/useOpsDualSync', () => ({
  useOpsDualSync: () => ({
    stateQuery: {
      data: { fields: [] },
      error: null,
      isError: false,
      isLoading: false,
    },
  }),
}));

vi.mock('@/hooks/ops/useOpsRestaurantLogoUpload', () => ({
  useOpsRestaurantLogoUpload: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock('@/hooks/ops/useOpsRestaurantBusinessContext', () => ({
  useOpsRestaurantBusinessContext: () => ({
    data: businessContextData,
    isLoading: false,
    error: null,
  }),
  useOpsUpdateRestaurantBusinessContext: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

const profile: RestaurantProfile = {
  id: 'rest-1',
  name: 'Old Crown Girton',
  slug: 'old-crown-girton',
  timezone: 'Europe/London',
  capacity: 40,
  contactEmail: 'ops@oldcrowngirton.example',
  contactPhone: '+441223277217',
  address: '1 High Street',
  businessDescription: null,
  managerDailySummaryEnabled: false,
  managerNotificationPhone: '+441223277217',
  googleMapUrl: 'https://maps.google.com/demo-venue',
  googleReviewUrl: 'https://g.page/demo-venue/review',
  bookingPolicy: null,
  logoUrl: null,
  emailSendReminder24h: true,
  emailSendReminderShort: true,
  emailSendReviewRequest: true,
  reservationIntervalMinutes: 15,
  reservationDefaultDurationMinutes: 90,
  reservationLastSeatingBufferMinutes: 15,
  reservationLifecycleGraceMinutes: 15,
  updatedAt: '2026-04-30T18:30:00.000Z',
};

vi.mock('@/hooks/ops/useOpsRestaurantDetails', () => ({
  useOpsRestaurantDetails: () => ({
    data: profile,
    error: null,
    isLoading: false,
    refetch: vi.fn(),
  }),
  useOpsUpdateRestaurantDetails: () => ({
    mutateAsync: updateProfileMock,
    isPending: false,
  }),
}));

import {
  buildProfileValues,
  deriveReadiness,
  displayProfileValue,
} from '@/components/features/restaurant-settings/restaurantProfileModel';
import { RestaurantProfileSection } from '@/components/features/restaurant-settings/RestaurantProfileSection';

import type { RestaurantProfile } from '@/services/ops/restaurants';

describe('RestaurantProfileSection', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    profile.name = 'Old Crown Girton';
    profile.slug = 'old-crown-girton';
    profile.timezone = 'Europe/London';
    profile.contactPhone = '+441223277217';
    profile.address = '1 High Street';
    profile.businessDescription = null;
    profile.logoUrl = null;
    updateProfileMock.mockReset();
    updateProfileMock.mockImplementation(async (payload: Partial<RestaurantProfile>) => ({
      ...profile,
      ...payload,
      updatedAt: '2026-04-30T19:00:00.000Z',
    }));
    analyticsTrackMock.mockReset();
    analyticsEmitMock.mockReset();
  });

  it('submits all dirty restaurant detail forms from the sticky save bar', async () => {
    const user = userEvent.setup();

    render(<RestaurantProfileSection restaurantId="rest-1" />);

    await screen.findAllByText('Brand and identity');
    await user.type(
      screen.getByRole('textbox', { name: /business description/i }),
      'Family friendly pub',
    );
    await user.click(screen.getByRole('button', { name: /^3 · Contact/i }));
    await user.clear(screen.getByRole('textbox', { name: /contact phone/i }));
    await user.type(screen.getByRole('textbox', { name: /contact phone/i }), '+447700900000');

    expect(await screen.findByText('2 unsaved profile sections')).toBeInTheDocument();
    expect(screen.getByText('2 unsaved profile sections').closest('[role="alert"]')).toHaveClass(
      'sticky',
      'bottom-0',
    );
    expect(
      screen.getByText(/save profile changes without leaving this settings workspace/i),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save all' }));

    await waitFor(() => expect(updateProfileMock).toHaveBeenCalledTimes(2));
    expect(updateProfileMock).toHaveBeenCalledWith({
      name: 'Old Crown Girton',
      businessDescription: 'Family friendly pub',
    });
    expect(updateProfileMock).toHaveBeenCalledWith(
      expect.objectContaining({
        contactPhone: '+447700900000',
      }),
    );
    expect(analyticsTrackMock).toHaveBeenCalledWith(
      'restaurant_profile_save_all_clicked',
      expect.objectContaining({
        restaurant_id: 'rest-1',
        dirty_section_count: 2,
        dirty_sections: ['brand', 'contact'],
        completeness_score: expect.any(Number),
        missing_count: expect.any(Number),
        elapsed_ms: expect.any(Number),
      }),
    );
    expect(analyticsEmitMock).toHaveBeenCalledWith(
      'restaurant_profile_save_all_clicked',
      expect.objectContaining({
        restaurant_id: 'rest-1',
        dirty_section_count: 2,
      }),
    );
    expect(analyticsTrackMock).not.toHaveBeenCalledWith(
      'restaurant_profile_save_all_clicked',
      expect.objectContaining({
        contactPhone: expect.any(String),
      }),
    );
    await waitFor(() =>
      expect(screen.queryByText('2 unsaved profile sections')).not.toBeInTheDocument(),
    );
    expect(screen.getAllByRole('status').map((node) => node.textContent)).toEqual(
      expect.arrayContaining([expect.stringMatching(/Saved just now/i)]),
    );
  });

  it('renders the consolidated profile overview with rail navigation', async () => {
    const user = userEvent.setup();

    render(<RestaurantProfileSection restaurantId="rest-1" />);

    await screen.findAllByText('Brand and identity');
    expect(screen.getByRole('navigation', { name: 'Profile sections' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /old crown girton/i })).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: /profile readiness/i })).toBeInTheDocument();
    expect(screen.getAllByText(/\/old-crown-girton/).length).toBeGreaterThan(0);
    expect(screen.queryByText('Not linked')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review booking URL' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Link Google' })).toHaveAttribute(
      'href',
      '/app/settings/restaurant/google-business-profile#gbp-connection',
    );
    expect(screen.queryByRole('link', { name: 'Compare with Google' })).not.toBeInTheDocument();

    const brandRail = screen.getByRole('button', { name: /^1 · Brand/i });
    const contactRail = screen.getByRole('button', { name: /^3 · Contact/i });
    const bookingRail = screen.getByRole('button', { name: /^2 · Booking link/i });
    const managerAlertsRail = screen.getByRole('button', { name: /^4 · Manager alerts/i });
    expect(brandRail).toBeInTheDocument();
    expect(contactRail).toBeInTheDocument();
    expect(bookingRail).toBeInTheDocument();
    expect(managerAlertsRail).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Discovery details/i })).not.toBeInTheDocument();

    await user.click(bookingRail);
    expect(screen.getByRole('textbox', { name: /booking page url/i })).toBeInTheDocument();
    expect(bookingRail).toHaveAttribute('aria-current', 'page');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps profile subform save actions in the sticky bar and cancels the active draft', async () => {
    const user = userEvent.setup();

    render(<RestaurantProfileSection restaurantId="rest-1" />);

    await screen.findAllByText('Brand and identity');
    const description = screen.getByRole('textbox', { name: /business description/i });
    await user.type(description, 'Family friendly pub');

    expect(screen.getByText('1 unsaved profile section')).toBeInTheDocument();
    const stickyBar = screen.getByText('1 unsaved profile section').closest('[role="alert"]');
    expect(stickyBar).not.toBeNull();
    expect(
      within(stickyBar as HTMLElement).getByRole('button', { name: 'Save brand' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /save brand & identity/i }),
    ).not.toBeInTheDocument();

    await user.click(
      within(stickyBar as HTMLElement).getByRole('button', { name: 'Cancel changes' }),
    );

    await waitFor(() => expect(description).toHaveValue(''));
    expect(screen.queryByText('1 unsaved profile section')).not.toBeInTheDocument();
  });

  it('renders contact blocks in Location, Public contact, After visit order', async () => {
    const user = userEvent.setup();

    render(<RestaurantProfileSection restaurantId="rest-1" />);

    await screen.findAllByText('Brand and identity');
    await user.click(screen.getByRole('button', { name: /^3 · Contact/i }));

    const contactForm = document.getElementById('restaurant-profile-contact-form');
    expect(contactForm).not.toBeNull();
    const location = within(contactForm as HTMLElement).getByText('Location');
    const publicContact = within(contactForm as HTMLElement).getByText('Public contact');
    const afterVisit = within(contactForm as HTMLElement).getByText('After visit');

    expect(location.compareDocumentPosition(publicContact)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(publicContact.compareDocumentPosition(afterVisit)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(document.getElementById('restaurant-timezone')).toBeInTheDocument();
    expect(document.getElementById('restaurant-address')).toBeInTheDocument();
    expect(document.getElementById('restaurant-google-map')).toBeInTheDocument();
    expect(document.getElementById('restaurant-phone')).toBeInTheDocument();
    expect(document.getElementById('restaurant-email')).toBeInTheDocument();
    expect(document.getElementById('restaurant-google-review')).toBeInTheDocument();
  });

  it('focuses the exact required field from the command-center primary action', async () => {
    const user = userEvent.setup();
    profile.slug = '';

    render(<RestaurantProfileSection restaurantId="rest-1" />);

    await screen.findAllByText('Brand and identity');
    const fixAction = await screen.findByRole('button', {
      name: /fix public booking page url/i,
    });
    await user.click(fixAction);

    const slugInput = await screen.findByRole('textbox', { name: /booking page url/i });
    await waitFor(() => expect(slugInput).toHaveFocus());
  });

  it('does not render legacy hash ids on profile cards', async () => {
    const { container } = render(<RestaurantProfileSection restaurantId="rest-1" />);

    await screen.findAllByText('Brand and identity');
    expect(container.querySelector('#profile-identity')).toBeNull();
    expect(container.querySelector('#profile-contact')).toBeNull();
    expect(container.querySelector('#profile-booking-url')).toBeNull();
    expect(container.querySelector('#profile-notifications')).toBeNull();
    expect(container.querySelector('#profile-discovery')).toBeNull();
  });

  it('opens the matching section from a legacy hash and clears the url hash', async () => {
    const replaceState = vi.spyOn(window.history, 'replaceState');

    window.location.hash = '#profile-contact';
    render(<RestaurantProfileSection restaurantId="rest-1" />);

    await waitFor(() => expect(screen.getByText('Contact and location')).toBeVisible());

    await waitFor(() =>
      expect(replaceState).toHaveBeenCalledWith(
        null,
        '',
        expect.not.stringContaining('#profile-contact'),
      ),
    );

    replaceState.mockRestore();
    window.location.hash = '';
  });

  it('renders the optional Google connection action without command-center footer links', async () => {
    render(<RestaurantProfileSection restaurantId="rest-1" />);

    await screen.findAllByText('Brand and identity');

    expect(screen.getByRole('link', { name: 'Link Google' })).toHaveAttribute(
      'href',
      '/app/settings/restaurant/google-business-profile#gbp-connection',
    );
    expect(screen.queryByRole('link', { name: 'Compare with Google' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /availability & booking types/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^team$/i })).not.toBeInTheDocument();
  });
});

describe('restaurant profile model', () => {
  it('derives profile values and readiness from profile data', () => {
    const values = buildProfileValues({
      ...profile,
      businessDescription: 'Village pub',
      logoUrl: 'https://cdn.example/logo.png',
    });
    const readiness = deriveReadiness(values, 'https://cdn.example/logo.png');

    expect(values).toEqual(
      expect.objectContaining({
        name: 'Old Crown Girton',
        slug: 'old-crown-girton',
        timezone: 'Europe/London',
        businessDescription: 'Village pub',
      }),
    );
    expect(readiness.score).toBe(100);
    expect(readiness.missing).toEqual([]);
  });

  it('formats preview helper values without leaking blank strings', () => {
    expect(displayProfileValue('  Old Crown  ', 'Fallback')).toBe('Old Crown');
    expect(displayProfileValue('   ', 'Fallback')).toBe('Fallback');
  });
});
