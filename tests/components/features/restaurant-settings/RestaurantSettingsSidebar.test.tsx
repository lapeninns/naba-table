import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/contexts/ops-unsaved-changes', () => ({
  useOpsUnsavedChanges: () => ({
    entries: [],
    hasUnsavedChanges: false,
    confirmNavigation: vi.fn(() => true),
  }),
}));

vi.mock(
  '@/components/features/restaurant-settings/useRestaurantSettingsNav',
  async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
      ...actual,
      useRestaurantSettingsNav: () => ({
        normalizedPathname: '/app/settings/restaurant/profile',
        getNavBadge: () => undefined,
        prefetchSettingsView: vi.fn(),
        handleLinkClick: vi.fn(),
      }),
    };
  },
);

vi.mock('@/components/features/restaurant-settings/shell/useRestaurantSettingsContext', () => ({
  useRestaurantSettingsContext: () => ({ restaurantName: 'Old Crown Girton' }),
}));

import { RestaurantSettingsSidebar } from '@/components/features/restaurant-settings/RestaurantSettingsSidebar';
import { SidebarProvider } from '@/components/ui/sidebar';

import { stubMatchMedia } from './testUtils';

describe('RestaurantSettingsSidebar', () => {
  beforeEach(() => {
    stubMatchMedia();
  });

  it('@smoke @a11y renders the settings header and navigation inside the sidebar', () => {
    render(
      <SidebarProvider>
        <RestaurantSettingsSidebar />
      </SidebarProvider>,
    );

    expect(screen.getByText('Old Crown Girton', { exact: false })).toHaveTextContent(
      'Settings for Old Crown Girton',
    );
    expect(screen.getByRole('navigation', { name: 'Restaurant settings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close settings menu' })).toBeInTheDocument();
  });
});
