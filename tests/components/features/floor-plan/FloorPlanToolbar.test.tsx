import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  FloorLayoutSaveBar,
  FloorPlanToolbar,
} from '@/components/features/floor-plan/FloorPlanToolbar';

import { snapshot } from './floorPlanFixtures';

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
    layoutSaveFailure: null,
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
      '/app/settings/restaurant/floor-layout',
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

  it('keeps the save bar out of the toolbar', () => {
    render(
      <FloorPlanToolbar
        fp={controller({ surface: 'layout', mode: 'arrange', dirtyIds: ['t1', 't2'] })}
      />,
    );

    expect(screen.queryByRole('region', { name: 'Unsaved changes' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save layout' })).not.toBeInTheDocument();
  });

  it('gives the arrange hint the full row when it would drop below 28rem, status end-aligned', () => {
    render(
      <FloorPlanToolbar
        fp={controller({
          surface: 'layout',
          mode: 'arrange',
          snapshot: snapshot(),
          data: {
            status: 'ready',
            isRefreshing: false,
            updatedAt: null,
          } as FloorPlanController['data'],
        })}
      />,
    );

    const hint = screen.getByText(/Arranging the layout\./).closest('p');
    expect(hint).toHaveAttribute('data-slot', 'floor-layout-hint');
    // Flex basis 28rem: shares the row with the status only when it keeps that width.
    expect(hint).toHaveClass('flex-[1_1_28rem]', 'min-w-0');
    expect(screen.getByRole('status')).toHaveClass('ml-auto');
  });

  it('offers the service and view choices as single-select segments', () => {
    render(<FloorPlanToolbar fp={controller({})} />);

    const view = screen.getByRole('group', { name: 'View' });
    expect(within(view).getByRole('radio', { name: 'Plan' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });
});

describe('FloorLayoutSaveBar', () => {
  // Docked below the workspace (or sticky when outside the settings shell), so the narrow-screen
  // sheet and the phone list view can't hide it.
  it('keeps unsaved layout changes savable', async () => {
    const user = userEvent.setup();
    const fp = controller({ surface: 'layout', mode: 'arrange', dirtyIds: ['t1', 't2'] });
    render(<FloorLayoutSaveBar fp={fp} />);

    const bar = screen.getByRole('region', { name: 'Unsaved changes' });
    expect(bar).toHaveTextContent('2 unsaved layout changes');
    await user.click(within(bar).getByRole('button', { name: 'Save layout' }));
    expect(fp.actions.saveLayout).toHaveBeenCalledOnce();
  });

  it('asks before discarding the layout changes', async () => {
    const user = userEvent.setup();
    const fp = controller({ surface: 'layout', mode: 'arrange', dirtyIds: ['t1'] });
    render(<FloorLayoutSaveBar fp={fp} />);

    await user.click(screen.getByRole('button', { name: 'Discard' }));
    expect(fp.actions.discardLayout).not.toHaveBeenCalled();

    const dialog = await screen.findByRole('alertdialog', { name: 'Discard all changes?' });
    expect(dialog).toHaveTextContent('1 unsaved layout change will be lost.');
    await user.click(within(dialog).getByRole('button', { name: 'Discard changes' }));
    expect(fp.actions.discardLayout).toHaveBeenCalledOnce();
  });

  it('shows a failed save with its reason code', () => {
    const fp = controller({
      surface: 'layout',
      mode: 'arrange',
      dirtyIds: ['t1'],
      layoutSaveFailure: {
        failedSection: '1 of 2 tables',
        saved: ['1 table'],
        notAttempted: [],
        reasonCode: 'PARTIAL_SAVE',
      },
    });
    render(<FloorLayoutSaveBar fp={fp} />);

    const bar = screen.getByRole('region', { name: 'Unsaved changes' });
    expect(bar).toHaveTextContent('1 of 2 tables not saved.');
    expect(bar).toHaveTextContent('Reason code PARTIAL_SAVE');
    expect(within(bar).getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('shows no save bar when the layout has no changes', () => {
    render(<FloorLayoutSaveBar fp={controller({ surface: 'layout', mode: 'arrange' })} />);

    expect(screen.queryByRole('region', { name: 'Unsaved changes' })).not.toBeInTheDocument();
  });
});
