import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FloorPlanToolbar } from '@/components/features/floor-plan/FloorPlanToolbar';

import type { FloorPlanController } from '@/components/features/floor-plan/useFloorPlanController';

/** Only the fields the toolbar's top row reads before any data has loaded. */
function controller(overrides: Partial<FloorPlanController>): FloorPlanController {
  const base = {
    surface: 'service',
    mode: 'service',
    canArrange: true,
    snapshot: null,
    data: { status: 'loading', isRefreshing: false, updatedAt: null },
    date: '2026-09-26',
    today: '2026-09-26',
    timezone: 'Europe/London',
    service: 'all',
    view: 'plan',
    dirtyIds: [],
    saveErrors: {},
    isSavingLayout: false,
    actions: {
      goToDate: vi.fn(),
      setView: vi.fn(),
      chooseService: vi.fn(),
      refresh: vi.fn(),
      discardLayout: vi.fn(),
      saveLayout: vi.fn(),
    },
  };
  return { ...base, ...overrides } as unknown as FloorPlanController;
}

describe('FloorPlanToolbar', () => {
  it('sends admins to the Floor layout settings page instead of an Arrange mode', () => {
    render(<FloorPlanToolbar fp={controller({})} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Floor plan' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit layout' })).toHaveAttribute(
      'href',
      '/app/settings/restaurant/table-layout',
    );
    expect(screen.queryByRole('radio', { name: 'Arrange' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh bookings' })).toBeInTheDocument();
  });

  it('hides the layout link from staff who cannot arrange tables', () => {
    render(<FloorPlanToolbar fp={controller({ canArrange: false })} />);

    expect(screen.queryByRole('link', { name: 'Edit layout' })).not.toBeInTheDocument();
  });

  it('shows no service controls or page heading on the Floor layout settings page', () => {
    render(<FloorPlanToolbar fp={controller({ surface: 'layout', mode: 'arrange' })} />);

    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'View' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Edit layout' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh tables' })).toBeInTheDocument();
  });

  // The save bar lives in the toolbar so the narrow-screen sheet and the phone list view can't hide it.
  it('keeps unsaved layout changes savable from the toolbar', () => {
    const fp = controller({ surface: 'layout', mode: 'arrange', dirtyIds: ['t1', 't2'] });
    render(<FloorPlanToolbar fp={fp} />);

    const bar = screen.getByRole('region', { name: 'Unsaved layout' });
    expect(bar).toHaveTextContent('2 unsaved layout changes');
    screen.getByRole('button', { name: 'Save layout' }).click();
    expect(fp.actions.saveLayout).toHaveBeenCalledOnce();
  });

  it('shows no save bar when the layout has no changes', () => {
    render(<FloorPlanToolbar fp={controller({ surface: 'layout', mode: 'arrange' })} />);

    expect(screen.queryByRole('region', { name: 'Unsaved layout' })).not.toBeInTheDocument();
  });
});
