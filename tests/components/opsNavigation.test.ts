import { describe, expect, it } from 'vitest';

import {
  OPS_NAV_SECTIONS,
  filterOpsNavigationSections,
} from '@/components/features/ops-shell/navigation';

describe('OPS_NAV_SECTIONS restaurant settings', () => {
  it('exposes a single Settings entry for all restaurant settings routes', () => {
    const settingsSection = OPS_NAV_SECTIONS.find((section) =>
      section.items.some((item) => item.title === 'Settings'),
    );

    expect(settingsSection).toBeDefined();
    expect(settingsSection?.items).toHaveLength(1);
    expect(settingsSection?.items[0]).toMatchObject({
      title: 'Settings',
      href: '/app/settings/restaurant/profile',
    });

    const settingsItem = settingsSection?.items[0];
    expect(settingsItem?.match?.('/app/settings/restaurant')).toBe(true);
    expect(settingsItem?.match?.('/app/settings/restaurant/profile')).toBe(true);
    expect(settingsItem?.match?.('/app/settings/restaurant/google-business-profile')).toBe(true);
    expect(settingsItem?.match?.('/app/settings/restaurant/team')).toBe(true);
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
      canViewAdminItems: false,
    });
    const titles = filtered.flatMap((section) => section.items.map((item) => item.title));

    expect(titles).not.toContain('SMS Delivery');
    expect(titles).toContain('Email Delivery');
  });

  it('keeps active-admin navigation for admin active memberships', () => {
    const filtered = filterOpsNavigationSections({
      canViewAdminItems: true,
    });
    const titles = filtered.flatMap((section) => section.items.map((item) => item.title));

    expect(titles).toContain('SMS Delivery');
  });
});
