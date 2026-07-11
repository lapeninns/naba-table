import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MenuHierarchyManagementPanel } from '@/components/features/menu/MenuHierarchyManagementPanel';

import {
  makeMenu,
  mutationStub,
  type MutationStub,
} from './__fixtures__/menuHierarchy';

import type { CanonicalRestaurantMenu } from '@/server/menu-hierarchy/types';

type HierarchyQueryStub = {
  data: { menus: CanonicalRestaurantMenu[] } | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  isFetching: boolean;
  isPlaceholderData: boolean;
  refetch: ReturnType<typeof vi.fn>;
};

const state = vi.hoisted(() => ({
  hierarchyQuery: undefined as unknown as HierarchyQueryStub,
  mutation: undefined as unknown as MutationStub,
}));

vi.mock('@/hooks/ops/useOpsMenuHierarchy', () => {
  const mutationHook = () => state.mutation;
  return {
    useOpsMenuHierarchy: () => state.hierarchyQuery,
    useOpsCreateRestaurantMenu: mutationHook,
    useOpsUpdateRestaurantMenu: mutationHook,
    useOpsCreateRestaurantMenuSection: mutationHook,
    useOpsUpdateRestaurantMenuSection: mutationHook,
    useOpsPatchRestaurantMenuSection: mutationHook,
    useOpsCreateRestaurantMenuItem: mutationHook,
    useOpsUpdateRestaurantMenuItem: mutationHook,
    useOpsPatchRestaurantMenuItem: mutationHook,
    useOpsCreateRestaurantMenuOption: mutationHook,
    useOpsPatchRestaurantMenuOption: mutationHook,
    useOpsDeleteRestaurantMenu: mutationHook,
    useOpsDeleteRestaurantMenuSection: mutationHook,
    useOpsDeleteRestaurantMenuItem: mutationHook,
    useOpsDeleteRestaurantMenuOption: mutationHook,
  };
});

function queryStub(overrides: Partial<HierarchyQueryStub> = {}): HierarchyQueryStub {
  return {
    data: { menus: [makeMenu()] },
    isLoading: false,
    isError: false,
    error: null,
    isFetching: false,
    isPlaceholderData: false,
    refetch: vi.fn(),
    ...overrides,
  };
}

function renderPanel(
  overrides: Partial<Parameters<typeof MenuHierarchyManagementPanel>[0]> = {},
) {
  return render(
    <MenuHierarchyManagementPanel
      restaurantId="rest-1"
      preferredMenuKind="food"
      {...overrides}
    />,
  );
}

describe('MenuHierarchyManagementPanel', () => {
  beforeEach(() => {
    state.hierarchyQuery = queryStub();
    state.mutation = mutationStub();
  });

  it('@contract asks for a restaurant when none is selected', () => {
    renderPanel({ restaurantId: null });

    expect(screen.getByText('Select a restaurant')).toBeInTheDocument();
  });

  it('@contract shows the load error state and retries the query', async () => {
    const user = userEvent.setup();
    state.hierarchyQuery = queryStub({
      isError: true,
      error: new Error('Menus unavailable'),
      data: undefined,
    });
    renderPanel();

    expect(screen.getByText('Unable to load menus')).toBeInTheDocument();
    expect(screen.getByText('Menus unavailable')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(state.hierarchyQuery.refetch).toHaveBeenCalledTimes(1);
  });

  it('@contract shows the loading state while fetching', () => {
    state.hierarchyQuery = queryStub({ isLoading: true, data: undefined });
    renderPanel();

    expect(screen.getByText('Loading menus...')).toBeInTheDocument();
  });

  it('@contract offers to create the first menu when none exist', async () => {
    const user = userEvent.setup();
    state.hierarchyQuery = queryStub({ data: { menus: [] } });
    renderPanel();

    expect(screen.getByText('No menus yet')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Create menu' }));
    expect(await screen.findByRole('dialog', { name: 'Create menu' })).toBeInTheDocument();
  });

  it('@contract prompts for the preferred kind when only other menus exist', () => {
    state.hierarchyQuery = queryStub({
      data: { menus: [makeMenu({ menuKind: 'food' })] },
    });
    renderPanel({ preferredMenuKind: 'drinks' });

    expect(screen.getByText('No drinks menu')).toBeInTheDocument();
  });

  it('@smoke renders the selected menu header and its sections', () => {
    renderPanel();

    expect(screen.getByRole('heading', { name: 'Dinner Menu' })).toBeInTheDocument();
    expect(screen.getByText('Starters')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('Burrata')).toBeInTheDocument();
  });

  it('@contract auto-selects the first matching menu and filters by kind', () => {
    state.hierarchyQuery = queryStub({
      data: {
        menus: [
          makeMenu({
            id: 'menu-drinks',
            menuKind: 'drinks',
            labels: [{ displayName: 'Drinks Menu', description: null, languageCode: 'en-GB' }],
            sections: [],
          }),
          makeMenu(),
        ],
      },
    });
    renderPanel({ preferredMenuKind: 'food' });

    expect(screen.getByRole('heading', { name: 'Dinner Menu' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Drinks Menu' })).not.toBeInTheDocument();
  });

  it('@contract opens the edit-menu dialog from the header toolbar', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: 'Edit' }));

    const dialog = await screen.findByRole('dialog', { name: 'Edit menu' });
    expect(within(dialog).getByDisplayValue('Dinner Menu')).toBeInTheDocument();
  });

  it('@contract opens the create-section dialog from the header toolbar', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: 'Section' }));

    expect(await screen.findByRole('dialog', { name: 'Create section' })).toBeInTheDocument();
  });

  it('@contract opens the delete confirmation for the selected menu', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: 'Open menu actions for Dinner Menu' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete menu' }));

    expect(await screen.findByRole('alertdialog', { name: 'Delete menu' })).toBeInTheDocument();
    expect(screen.getByText(/This removes Dinner Menu/)).toBeInTheDocument();
  });

  it('@contract opens the item dialog scoped to a section from Add item', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: 'Add item' }));

    expect(await screen.findByRole('dialog', { name: 'Create item' })).toBeInTheDocument();
  });
});
