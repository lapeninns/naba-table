import { describe, expect, it } from 'vitest';

import {
  OPS_NAV_SECTIONS,
  filterOpsNavigationSections,
} from '@/components/features/ops-shell/navigation';

const disabledFlags = {
  opsMetrics: false,
  selectorScoring: false,
  rejectionAnalytics: false,
};

describe('OPS_NAV_SECTIONS restaurant settings', () => {
  it('includes Google Business Profile in the main sidebar section', () => {
    const restaurantSettings = OPS_NAV_SECTIONS.find((section) => section.label === 'Restaurant Settings');

    expect(restaurantSettings).toBeDefined();
    expect(restaurantSettings?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Google Business Profile',
          href: '/app/settings/restaurant/google-business-profile',
        }),
      ]),
    );

    const gbpItem = restaurantSettings?.items.find((item) => item.title === 'Google Business Profile');
    expect(gbpItem?.match?.('/app/settings/restaurant/google-business-profile')).toBe(true);
    expect(gbpItem?.match?.('/app/settings/restaurant/google-business-profile/details')).toBe(true);
  });

  it('marks SMS Delivery as active-admin navigation', () => {
    const guestInsights = OPS_NAV_SECTIONS.find((section) => section.label === 'Guest & Insights');
    const smsItem = guestInsights?.items.find((item) => item.title === 'SMS Delivery');

    expect(smsItem).toMatchObject({
      href: '/app/sms-delivery',
      requiresActiveAdmin: true,
    });
  });

  it('hides active-admin navigation for non-admin active memberships', () => {
    const filtered = filterOpsNavigationSections({
      featureFlags: disabledFlags,
      canViewAdminItems: false,
    });
    const titles = filtered.flatMap((section) => section.items.map((item) => item.title));

    expect(titles).not.toContain('SMS Delivery');
    expect(titles).toContain('Email Delivery');
  });

  it('keeps active-admin navigation for admin active memberships', () => {
    const filtered = filterOpsNavigationSections({
      featureFlags: disabledFlags,
      canViewAdminItems: true,
    });
    const titles = filtered.flatMap((section) => section.items.map((item) => item.title));

    expect(titles).toContain('SMS Delivery');
  });
});
