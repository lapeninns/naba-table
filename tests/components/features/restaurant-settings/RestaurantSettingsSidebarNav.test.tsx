import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const unsavedState = vi.hoisted(() => ({
  entries: [] as Array<{ id: string; message?: string }>,
}));

vi.mock('@/contexts/ops-unsaved-changes', () => ({
  useOpsUnsavedChanges: () => ({
    entries: unsavedState.entries,
    hasUnsavedChanges: unsavedState.entries.length > 0,
    confirmNavigation: vi.fn(() => true),
  }),
}));

import { RestaurantSettingsSidebarNav } from '@/components/features/restaurant-settings/RestaurantSettingsSidebarNav';
import { SidebarProvider } from '@/components/ui/sidebar';

import { stubMatchMedia } from './testUtils';

function renderNav(overrides: Partial<Parameters<typeof RestaurantSettingsSidebarNav>[0]> = {}) {
  const props = {
    // Normalized paths have the /app host prefix stripped (normalizeOpsPathname).
    normalizedPathname: '/settings/restaurant/profile',
    getNavBadge: vi.fn(() => undefined),
    prefetchSettingsView: vi.fn(),
    onLinkClick: vi.fn(),
    ...overrides,
  };
  render(
    <SidebarProvider>
      <RestaurantSettingsSidebarNav {...props} />
    </SidebarProvider>,
  );
  return props;
}

describe('RestaurantSettingsSidebarNav', () => {
  beforeEach(() => {
    stubMatchMedia();
    unsavedState.entries = [];
  });

  it('@smoke @a11y renders the settings navigation landmark with links', () => {
    renderNav();

    const nav = screen.getByRole('navigation', { name: 'Restaurant settings' });
    expect(within(nav).getAllByRole('link').length).toBeGreaterThanOrEqual(5);
    expect(within(nav).getByRole('link', { name: 'Restaurant profile' })).toBeInTheDocument();
  });

  it('@contract @a11y marks the active item with aria-current', () => {
    renderNav({ normalizedPathname: '/settings/restaurant/profile' });

    const active = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('aria-current') === 'page');
    expect(active).toHaveLength(1);
    expect(active[0]).toHaveAttribute('href', '/app/settings/restaurant/profile');
  });

  it('@contract prefetches a settings view on hover and forwards link clicks', async () => {
    const user = userEvent.setup();
    const props = renderNav();

    const profileLink = screen.getByRole('link', { name: 'Restaurant profile' });
    await user.hover(profileLink);
    expect(props.prefetchSettingsView).toHaveBeenCalledWith('/app/settings/restaurant/profile');

    await user.click(profileLink);
    expect(props.onLinkClick).toHaveBeenCalled();
  });

  it('@contract does not prefetch again when focus comes from a mouse click', async () => {
    const user = userEvent.setup();
    const props = renderNav();

    const availabilityLink = screen.getByRole('link', { name: 'Availability & Booking types' });
    await user.hover(availabilityLink);
    await user.click(availabilityLink);

    expect(availabilityLink).toHaveFocus();
    expect(props.prefetchSettingsView).toHaveBeenCalledTimes(1);
    expect(props.onLinkClick).toHaveBeenCalledTimes(1);
  });

  it('@contract @a11y still prefetches when a link receives keyboard focus', async () => {
    const user = userEvent.setup();
    const props = renderNav();

    // A mouse click elsewhere must not suppress a later keyboard focus.
    await user.click(screen.getByRole('link', { name: 'Restaurant profile' }));
    props.prefetchSettingsView.mockClear();

    await user.tab();

    expect(document.activeElement).not.toBe(
      screen.getByRole('link', { name: 'Restaurant profile' }),
    );
    expect(props.prefetchSettingsView).toHaveBeenCalledTimes(1);
    expect(props.prefetchSettingsView).toHaveBeenCalledWith(
      document.activeElement?.getAttribute('href'),
    );
  });

  it('@contract renders nav badges supplied by the badge lookup', () => {
    renderNav({
      getNavBadge: vi.fn((href: string) =>
        href === '/app/settings/restaurant/google-business-profile' ? '3' : undefined,
      ),
    });

    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('@contract labels a page with unsaved changes "Unsaved" in text, not a dot', () => {
    unsavedState.entries = [{ id: 'restaurant-availability' }];
    renderNav();

    const link = screen.getByRole('link', { name: /Availability & Booking types/ });
    expect(within(link).getByText('Unsaved')).toBeInTheDocument();
    expect(screen.getAllByText('Unsaved')).toHaveLength(1);
  });

  it('@contract lists Restaurant setup first, then the groups by the job each page does', () => {
    renderNav();

    const nav = screen.getByRole('navigation', { name: 'Restaurant settings' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/app/settings/restaurant',
      '/app/settings/restaurant/profile',
      '/app/settings/restaurant/availability',
      '/app/settings/restaurant/tables',
      '/app/settings/restaurant/discovery',
      '/app/settings/restaurant/menu',
      '/app/settings/restaurant/table-layout',
      '/app/settings/restaurant/email-templates',
      '/app/settings/restaurant/team',
      '/app/settings/restaurant/staff-communications',
      '/app/settings/restaurant/google-business-profile',
    ]);
    const labels = [
      'Required setup',
      'Restaurant details',
      'Guest communications',
      'Staff',
      'Integrations',
    ];
    for (const label of labels) {
      expect(screen.getByText(label, { selector: '[data-sidebar="group-label"]' })).toBeVisible();
    }
    expect(screen.queryByText('Operations')).not.toBeInTheDocument();
  });

  it('@contract marks Floor layout "Unsaved" while floor plan layout drafts are pending', () => {
    unsavedState.entries = [{ id: 'floor-plan-layout' }];
    renderNav({ normalizedPathname: '/settings/restaurant/table-layout' });

    const link = screen.getByRole('link', { name: /Floor layout/ });
    expect(link).toHaveAttribute('aria-current', 'page');
    expect(within(link).getByText('Unsaved')).toBeInTheDocument();
  });

  it('@contract marks Staff communications active and "Unsaved" from its own draft', () => {
    unsavedState.entries = [{ id: 'restaurant-staff-communications' }];
    renderNav({ normalizedPathname: '/settings/restaurant/staff-communications' });

    const link = screen.getByRole('link', { name: /Staff communications/ });
    expect(link).toHaveAttribute('aria-current', 'page');
    expect(within(link).getByText('Unsaved')).toBeInTheDocument();
    expect(screen.getAllByText('Unsaved')).toHaveLength(1);
  });

  it.each(['service-periods', 'operating-hours', 'occasions', 'turn-durations'])(
    '@contract keeps Availability active on the former %s route',
    (slug) => {
      renderNav({ normalizedPathname: `/settings/restaurant/${slug}` });

      const active = screen
        .getAllByRole('link')
        .filter((link) => link.getAttribute('aria-current') === 'page');
      expect(active.map((link) => link.getAttribute('href'))).toEqual([
        '/app/settings/restaurant/availability',
      ]);
    },
  );
});
