import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const confirmNavigationMock = vi.hoisted(() => vi.fn(() => true));

vi.mock('@/contexts/ops-unsaved-changes', () => ({
  useOpsUnsavedChanges: () => ({
    entries: [],
    hasUnsavedChanges: false,
    confirmNavigation: confirmNavigationMock,
  }),
}));

vi.mock('@/components/features/restaurant-settings/shell/useRestaurantSettingsContext', () => ({
  useRestaurantSettingsContext: () => ({
    headingContext: null,
    restaurantName: 'Old Crown Girton',
    restaurantId: 'rest-1',
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

import { RestaurantSettingsFocusedShell } from '@/components/features/restaurant-settings/RestaurantSettingsFocusedShell';

import { stubMatchMedia } from './testUtils';

describe('RestaurantSettingsFocusedShell', () => {
  beforeEach(() => {
    stubMatchMedia();
  });

  it('@smoke @a11y composes chrome, sidebar, skip link, and page content', () => {
    render(
      <RestaurantSettingsFocusedShell>
        <p>Settings page content</p>
      </RestaurantSettingsFocusedShell>,
    );

    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute(
      'href',
      '#ops-content',
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'Restaurant settings' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Restaurant settings' })).toBeInTheDocument();
    expect(screen.getByText('Settings page content')).toBeInTheDocument();
  });

  it('@contract renders the environment banner as a status region when provided', () => {
    render(
      <RestaurantSettingsFocusedShell envBanner="Staging environment">
        <p>Content</p>
      </RestaurantSettingsFocusedShell>,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Staging environment');
  });

  it('@a11y lifts settings inputs and selects to 44px on coarse pointers via the content area', () => {
    render(
      <RestaurantSettingsFocusedShell>
        <p>Settings page content</p>
      </RestaurantSettingsFocusedShell>,
    );

    const content = document.getElementById('ops-content');
    expect(content?.className).toContain(
      '[@media(pointer:coarse)]:[&_[data-slot=input]:not(.sr-only)',
    );
    expect(content?.className).toContain(
      '[@media(pointer:coarse)]:[&_button[role=combobox]]:min-h-11',
    );
  });

  it('@a11y applies the same touch scope to full-height workspaces', () => {
    render(
      <RestaurantSettingsFocusedShell workspace>
        <p>Workspace content</p>
      </RestaurantSettingsFocusedShell>,
    );

    expect(document.getElementById('ops-content')?.className).toContain(
      '[@media(pointer:coarse)]:[&_button[role=combobox]]:min-h-11',
    );
  });
});
