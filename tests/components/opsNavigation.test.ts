import { describe, expect, it } from 'vitest';

import {
  OPS_NAV_SECTIONS,
  filterOpsNavigationSections,
  isNavItemActive,
} from '@/components/features/ops-shell/navigation';
import { opsHref } from '@/lib/url/opsHref';

function findNavItem(title: string) {
  const item = OPS_NAV_SECTIONS.flatMap((section) => section.items).find(
    (candidate) => candidate.title === title,
  );
  if (!item) {
    throw new Error(`Nav item not found: ${title}`);
  }
  return item;
}

describe('isNavItemActive with app-host pathnames', () => {
  // App-host URLs drop the /app prefix; consumers must normalize the browser
  // pathname with opsHref before matching (OpsSidebarPanel, OpsMobileBottomNav).
  it('matches app-host pathnames once normalized with opsHref', () => {
    expect(isNavItemActive(opsHref('/bookings'), findNavItem('Bookings'))).toBe(true);
    expect(isNavItemActive(opsHref('/dashboard'), findNavItem('Dashboard'))).toBe(true);
    expect(isNavItemActive(opsHref('/settings/restaurant/profile'), findNavItem('Settings'))).toBe(
      true,
    );
    expect(isNavItemActive(opsHref('/bookings'), findNavItem('Dashboard'))).toBe(false);
  });

  it('keeps matching internal /app/* pathnames unchanged through opsHref', () => {
    expect(isNavItemActive(opsHref('/app/bookings'), findNavItem('Bookings'))).toBe(true);
    expect(isNavItemActive(opsHref('/app/dashboard'), findNavItem('Dashboard'))).toBe(true);
  });

  it('does not match raw app-host pathnames without normalization', () => {
    expect(isNavItemActive('/bookings', findNavItem('Bookings'))).toBe(false);
  });
});

describe('OPS_NAV_SECTIONS order', () => {
  it('orders each group by how often it is used during service', () => {
    expect(
      OPS_NAV_SECTIONS.map((section) => ({
        label: section.label ?? null,
        titles: section.items.map((item) => item.title),
      })),
    ).toEqual([
      { label: 'Service', titles: ['Dashboard', 'New Booking', 'Floor plan', 'Bookings'] },
      { label: 'Guests & Communications', titles: ['Guests', 'Communications Delivery'] },
      { label: null, titles: ['Settings'] },
    ]);
  });

  it('keeps New Booking pointing at the booking wizard', () => {
    const item = findNavItem('New Booking');
    expect(item.href).toBe('/app/new-bookings');
    expect(isNavItemActive('/app/new-bookings', item)).toBe(true);
  });
});

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

  it('marks Communications Delivery as active-admin navigation', () => {
    const guestsSection = OPS_NAV_SECTIONS.find(
      (section) => section.label === 'Guests & Communications',
    );
    const communicationsItem = guestsSection?.items.find(
      (item) => item.title === 'Communications Delivery',
    );

    expect(communicationsItem).toMatchObject({
      href: '/app/communications-delivery',
      requiresActiveAdmin: true,
    });
  });

  it('hides active-admin navigation for non-admin active memberships', () => {
    const filtered = filterOpsNavigationSections({
      canViewAdminItems: false,
    });
    const titles = filtered.flatMap((section) => section.items.map((item) => item.title));

    expect(titles).not.toContain('Communications Delivery');
    expect(titles).toContain('Guests');
  });

  it('keeps active-admin navigation for admin active memberships', () => {
    const filtered = filterOpsNavigationSections({
      canViewAdminItems: true,
    });
    const titles = filtered.flatMap((section) => section.items.map((item) => item.title));

    expect(titles).toContain('Communications Delivery');
  });
});
