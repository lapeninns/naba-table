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
  formatLastUpdated,
  getInitials,
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

    await screen.findByText('Profile readiness');
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

  it('tracks common-edit shortcut clicks without profile field values', async () => {
    const user = userEvent.setup();

    render(<RestaurantProfileSection restaurantId="rest-1" />);

    await screen.findByText('Common edits');
    await user.click(screen.getByRole('button', { name: 'Common edits' }));
    const contactShortcut = screen.getByText('Phone + email').closest('a');
    expect(contactShortcut).toBeInTheDocument();
    await user.click(contactShortcut!);

    expect(analyticsTrackMock).toHaveBeenCalledWith(
      'restaurant_profile_common_edit_clicked',
      expect.objectContaining({
        restaurant_id: 'rest-1',
        action: 'contact',
        href: '#profile-contact',
        completeness_score: expect.any(Number),
        missing_count: expect.any(Number),
      }),
    );
    expect(analyticsEmitMock).toHaveBeenCalledWith(
      'restaurant_profile_common_edit_clicked',
      expect.objectContaining({
        restaurant_id: 'rest-1',
        action: 'contact',
      }),
    );
    expect(analyticsTrackMock).not.toHaveBeenCalledWith(
      'restaurant_profile_common_edit_clicked',
      expect.objectContaining({
        contactPhone: expect.any(String),
      }),
    );
  });

  it('shows the requested profile section model', async () => {
    render(<RestaurantProfileSection restaurantId="rest-1" />);

    const expectSectionLink = (detail: string, href: string) => {
      const sectionLink = screen.getByText(detail).closest('a');
      expect(sectionLink).toBeInTheDocument();
      expect(sectionLink).toHaveAttribute('href', href);
    };

    await screen.findByText('Profile sections');
    expect(
      screen.getByText(/Opening hours are managed in Availability/i).parentElement,
    ).toHaveClass('rounded-md', 'bg-muted/30');
    expectSectionLink('Name and public description', '#profile-identity');
    expectSectionLink('Logo and guest recognition', '#profile-identity');
    expectSectionLink('Phone and email', '#profile-contact');
    expectSectionLink('Address and directions', '#profile-contact');
    expectSectionLink('Alerts and booking links', '#profile-operations');
    expectSectionLink('Discovery and Google-facing details', '#profile-visibility');
    expect(screen.getByText('Basic Info and Branding')).toBeInTheDocument();
    expect(screen.getByText('Contact and Location')).toBeInTheDocument();
    expect(screen.getAllByText('Operational Details').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Visibility').length).toBeGreaterThanOrEqual(2);
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
    expect(getInitials('Old Crown Girton')).toBe('OC');
    expect(getInitials('')).toBe('RR');
    expect(formatLastUpdated('not-a-date')).toBeNull();
    expect(formatLastUpdated('2026-04-30T18:30:00.000Z')).toEqual(expect.any(String));
  });
});
