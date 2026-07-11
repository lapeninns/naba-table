import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const unsavedState = vi.hoisted(() => ({ hasUnsavedChanges: false }));
const settingsContextState = vi.hoisted(() => ({
  headingContext: null as unknown,
  restaurantName: null as string | null,
}));

vi.mock('@/contexts/ops-unsaved-changes', () => ({
  useOpsUnsavedChanges: () => ({
    hasUnsavedChanges: unsavedState.hasUnsavedChanges,
    entries: [],
    confirmNavigation: vi.fn(() => true),
  }),
}));

vi.mock('@/components/features/restaurant-settings/shell/useRestaurantSettingsContext', () => ({
  useRestaurantSettingsContext: () => ({
    headingContext: settingsContextState.headingContext,
    restaurantName: settingsContextState.restaurantName,
    restaurantId: 'rest-1',
  }),
}));

import { RestaurantSettingsChromeHeader } from '@/components/features/restaurant-settings/RestaurantSettingsChromeHeader';
import { SidebarProvider } from '@/components/ui/sidebar';

import { stubMatchMedia } from './testUtils';

function renderHeader(onExitClick = vi.fn()) {
  render(
    <SidebarProvider>
      <RestaurantSettingsChromeHeader onExitClick={onExitClick} />
    </SidebarProvider>,
  );
  return { onExitClick };
}

describe('RestaurantSettingsChromeHeader', () => {
  beforeEach(() => {
    stubMatchMedia();
    unsavedState.hasUnsavedChanges = false;
    settingsContextState.headingContext = null;
    settingsContextState.restaurantName = null;
  });

  it('@smoke @a11y renders the fallback heading and the labelled exit link', () => {
    renderHeader();

    expect(
      screen.getByRole('heading', { name: 'Restaurant settings', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Close restaurant settings' })).toBeInTheDocument();
  });

  it('@contract renders breadcrumb parent and leaf when the route provides one', () => {
    settingsContextState.headingContext = {
      chromeBreadcrumb: {
        parentTitle: 'Availability',
        parentHref: '/app/settings/restaurant/availability',
        leafTitle: 'Weekly schedule',
      },
      chromeLeafTitle: 'Weekly schedule',
    };
    renderHeader();

    expect(screen.getByRole('link', { name: 'Availability' })).toHaveAttribute(
      'href',
      '/app/settings/restaurant/availability',
    );
    expect(screen.getByText('Weekly schedule')).toBeInTheDocument();
  });

  it('@contract shows unsaved-changes and restaurant badges when present', () => {
    unsavedState.hasUnsavedChanges = true;
    settingsContextState.restaurantName = 'Old Crown Girton';
    renderHeader();

    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    expect(screen.getByText('Old Crown Girton')).toBeInTheDocument();
  });

  it('@contract invokes the exit guard when the close link is clicked', async () => {
    const user = userEvent.setup();
    const onExitClick = vi.fn((event: React.MouseEvent<HTMLAnchorElement>) =>
      event.preventDefault(),
    );
    renderHeader(onExitClick);

    await user.click(screen.getByRole('link', { name: 'Close restaurant settings' }));

    expect(onExitClick).toHaveBeenCalledTimes(1);
  });
});
