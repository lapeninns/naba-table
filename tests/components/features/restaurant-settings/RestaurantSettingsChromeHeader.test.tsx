import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const unsavedState = vi.hoisted(() => ({ hasUnsavedChanges: false }));
const settingsContextState = vi.hoisted(() => ({
  headingContext: null as unknown,
  pathname: null as string | null,
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
    pathname: settingsContextState.pathname,
    restaurantName: settingsContextState.restaurantName,
    restaurantId: 'rest-1',
  }),
}));

import { RestaurantSettingsChromeHeader } from '@/components/features/restaurant-settings/RestaurantSettingsChromeHeader';
import { SidebarProvider } from '@/components/ui/sidebar';

import { stubMatchMedia } from './testUtils';

function renderHeader(
  onExitClick = vi.fn(),
  { sidebarOpen = true, title }: { sidebarOpen?: boolean; title?: string } = {},
) {
  render(
    <SidebarProvider defaultOpen={sidebarOpen}>
      <RestaurantSettingsChromeHeader onExitClick={onExitClick} title={title} />
    </SidebarProvider>,
  );
  return { onExitClick };
}

describe('RestaurantSettingsChromeHeader', () => {
  beforeEach(() => {
    stubMatchMedia();
    unsavedState.hasUnsavedChanges = false;
    settingsContextState.headingContext = null;
    settingsContextState.pathname = null;
    settingsContextState.restaurantName = null;
  });

  it('@smoke @a11y renders the fallback heading and the labelled exit link', () => {
    renderHeader();

    expect(
      screen.getByRole('heading', { name: 'Restaurant settings', level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Close restaurant settings' })).toBeInTheDocument();
  });

  it('@contract renders a Settings crumb ahead of the h1 page title', () => {
    settingsContextState.pathname = '/app/settings/restaurant/availability';
    settingsContextState.headingContext = { chromeLeafTitle: 'Availability & Booking types' };
    renderHeader();

    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(breadcrumb).getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'href',
      '/app/settings/restaurant',
    );
    // The page itself is the h1, not a crumb.
    expect(
      screen.getByRole('heading', { level: 1, name: 'Availability & Booking types' }),
    ).toBeInTheDocument();
    expect(within(breadcrumb).queryByText('Availability & Booking types')).not.toBeInTheDocument();
  });

  it('@contract omits the breadcrumb on the settings overview', () => {
    settingsContextState.pathname = '/app/settings/restaurant';
    settingsContextState.headingContext = { chromeLeafTitle: 'Restaurant setup' };
    renderHeader();

    expect(screen.getByRole('heading', { level: 1, name: 'Restaurant setup' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Breadcrumb' })).not.toBeInTheDocument();
  });

  it('@contract uses an explicit title over route copy for legacy pages', () => {
    settingsContextState.pathname = '/app/settings/tables';
    renderHeader(vi.fn(), { title: 'Tables' });

    expect(screen.getByRole('heading', { level: 1, name: 'Tables' })).toBeInTheDocument();
  });

  it('@contract shows a short unsaved status on phones and the full label from sm', () => {
    unsavedState.hasUnsavedChanges = true;
    renderHeader();

    expect(screen.getByText('Unsaved')).toHaveClass('sm:hidden');
    expect(screen.getByText('Unsaved changes')).toHaveClass('hidden', 'sm:inline');
  });

  it('@contract names the restaurant only when the sidebar rail hides it', () => {
    settingsContextState.restaurantName = 'Old Crown Girton';
    renderHeader();
    expect(screen.queryByText('Old Crown Girton')).not.toBeInTheDocument();
  });

  it('@contract names the restaurant in the chrome when the sidebar is collapsed', () => {
    settingsContextState.restaurantName = 'Old Crown Girton';
    renderHeader(vi.fn(), { sidebarOpen: false });
    expect(screen.getByText('Old Crown Girton')).toBeInTheDocument();
  });

  it('@contract lets long titles wrap to two lines on phones before truncating', () => {
    settingsContextState.headingContext = { chromeLeafTitle: 'Availability & Booking types' };
    renderHeader();

    const title = screen.getByRole('heading', { name: 'Availability & Booking types', level: 1 });
    expect(title).toHaveClass('line-clamp-2', 'sm:line-clamp-1', 'break-words', 'min-w-0');
    expect(title).toHaveAttribute('title', 'Availability & Booking types');
    expect(
      screen.getByRole('button', { name: 'Toggle restaurant settings navigation' }),
    ).toHaveClass('md:hidden');
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
