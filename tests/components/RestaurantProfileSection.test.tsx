import { render, screen, waitFor } from '@testing-library/react';
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

    await screen.findByText('Brand and identity');
    await user.type(
      screen.getByRole('textbox', { name: /business description/i }),
      'Family friendly pub',
    );
    await user.clear(screen.getByRole('textbox', { name: /contact phone/i }));
    await user.type(screen.getByRole('textbox', { name: /contact phone/i }), '+447700900000');

    expect(await screen.findByText('2 unsaved profile sections')).toBeInTheDocument();
    expect(screen.getByText('2 unsaved profile sections').closest('[role="alert"]')).toHaveClass(
      'sticky',
      'bottom-0',
    );
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
      expect.arrayContaining([
        expect.stringMatching(/Brand and identity saved\. Last updated/i),
        expect.stringMatching(/Contact and location saved\. Last updated/i),
      ]),
    );
  });

  it('renders the profile card stack with one card per concern', async () => {
    render(<RestaurantProfileSection restaurantId="rest-1" />);

    await screen.findByText('Brand and identity');
    expect(screen.getByText('Contact and location')).toBeInTheDocument();
    expect(screen.getByText('Manager notifications')).toBeInTheDocument();
    expect(screen.getByText('Discovery details')).toBeInTheDocument();
    expect(screen.getByText('Advanced')).toBeInTheDocument();
    // No accordion: there should be no `region` accordion items wrapping the cards.
    expect(document.querySelector('[data-state="open"][data-orientation]')).toBeNull();
  });

  it('exposes the promised hash anchors for each profile card', async () => {
    const { container } = render(<RestaurantProfileSection restaurantId="rest-1" />);

    await screen.findByText('Brand and identity');
    expect(container.querySelector('#profile-identity')).not.toBeNull();
    expect(container.querySelector('#profile-contact')).not.toBeNull();
    expect(container.querySelector('#profile-notifications')).not.toBeNull();
    expect(container.querySelector('#profile-discovery')).not.toBeNull();
    expect(container.querySelector('#profile-advanced')).not.toBeNull();
  });

  it('shows the single Review Google CTA and cross-links to availability and team', async () => {
    render(<RestaurantProfileSection restaurantId="rest-1" />);

    await screen.findByText('Brand and identity');
    const reviewLinks = screen.getAllByRole('link', { name: /review google changes/i });
    expect(reviewLinks).toHaveLength(1);
    expect(reviewLinks[0]).toHaveAttribute(
      'href',
      '/app/settings/restaurant/google-business-profile',
    );

    const availabilityLink = screen.getByRole('link', { name: /availability & occasions/i });
    expect(availabilityLink).toHaveAttribute(
      'href',
      '/app/settings/restaurant/availability#booking-rules',
    );

    const teamLink = screen.getByRole('link', { name: /^team$/i });
    expect(teamLink).toHaveAttribute('href', '/app/settings/restaurant/team');
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
