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

  it('@contract renders nav badges supplied by the badge lookup', () => {
    renderNav({
      getNavBadge: vi.fn((href: string) =>
        href === '/app/settings/restaurant/google-business-profile' ? '3' : undefined,
      ),
    });

    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('@contract shows the unsaved-changes dot for a dirty section', () => {
    unsavedState.entries = [{ id: 'restaurant-profile' }];
    renderNav();

    expect(screen.getByLabelText('Unsaved changes alert')).toBeInTheDocument();
  });
});
