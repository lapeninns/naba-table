import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MenuHierarchyManagementPanel } from '@/components/features/menu/MenuHierarchyManagementPanel';

import {
  makeItem,
  makeMenu,
  makeSection,
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
    useOpsCreateRestaurantMenuItem: mutationHook,
    useOpsUpdateRestaurantMenuItem: mutationHook,
    useOpsCreateRestaurantMenuOption: mutationHook,
    useOpsUpdateRestaurantMenuOption: mutationHook,
    useOpsReorderMenuChildren: mutationHook,
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

function renderPanel(overrides: Partial<Parameters<typeof MenuHierarchyManagementPanel>[0]> = {}) {
  return render(
    <MenuHierarchyManagementPanel restaurantId="rest-1" preferredMenuKind="food" {...overrides} />,
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
    // The purpose line stays visible in every state.
    expect(screen.getByText(/Food and drinks guests can see\./)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New menu' })).not.toBeInTheDocument();
  });

  it('@contract shows the load error state and retries the query', async () => {
    const user = userEvent.setup();
    state.hierarchyQuery = queryStub({
      isError: true,
      error: new Error('Menus unavailable'),
      data: undefined,
    });
    renderPanel();

    expect(screen.getByRole('alert')).toHaveTextContent('Couldn’t load menus');
    expect(screen.queryByText('Menus unavailable')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New menu' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(state.hierarchyQuery.refetch).toHaveBeenCalledTimes(1);
  });

  it('@contract keeps the loaded menu on screen when a refetch fails', async () => {
    const user = userEvent.setup();
    state.hierarchyQuery = queryStub({ isError: true, error: new Error('Menus unavailable') });
    renderPanel();

    expect(screen.getByText('Couldn’t refresh saved settings')).toBeInTheDocument();
    expect(screen.queryByText('Couldn’t load menus')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Dinner Menu' })).toBeInTheDocument();
    expect(screen.queryByText('Menus unavailable')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(state.hierarchyQuery.refetch).toHaveBeenCalledTimes(1);
  });

  it('@contract puts New menu and the catalogue counts in the page header', async () => {
    const user = userEvent.setup();
    const { container } = renderPanel();

    const facts = container.querySelector<HTMLElement>('[data-slot="settings-status-facts"]');
    expect(facts).not.toBeNull();
    expect(within(facts!).getByText('1 menu')).toBeInTheDocument();
    expect(within(facts!).getByText('1 section')).toBeInTheDocument();
    expect(within(facts!).getByText('1 item')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'New menu' }));
    expect(await screen.findByRole('dialog', { name: 'New menu' })).toBeInTheDocument();
  });

  it('@a11y docks the catalogue links as the page rail', () => {
    renderPanel({
      catalogueRailItems: [
        { label: 'Food menus', href: '/app/settings/restaurant/menu?catalog=food', isActive: true },
        { label: 'Drinks and bar', href: '/app/settings/restaurant/menu?catalog=drinks' },
      ],
    });

    const rail = screen.getByRole('navigation', { name: 'Menu catalogues' });
    expect(within(rail).getByRole('link', { name: 'Food menus' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(rail).getByRole('link', { name: 'Drinks and bar' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('@contract shows the loading state while fetching', () => {
    state.hierarchyQuery = queryStub({ isLoading: true, data: undefined });
    renderPanel();

    expect(screen.getByText('Loading menus…')).toBeInTheDocument();
  });

  it('@contract offers to create the first menu when none exist', async () => {
    const user = userEvent.setup();
    state.hierarchyQuery = queryStub({ data: { menus: [] } });
    renderPanel();

    expect(screen.getByText('No menus yet')).toBeInTheDocument();
    // The empty state's own action is the only primary on screen.
    expect(screen.queryByRole('button', { name: 'New menu' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Create menu' }));
    expect(await screen.findByRole('dialog', { name: 'New menu' })).toBeInTheDocument();
  });

  it('@contract prompts for the preferred kind when only other menus exist', () => {
    state.hierarchyQuery = queryStub({
      data: { menus: [makeMenu({ menuKind: 'food' })] },
    });
    renderPanel({ preferredMenuKind: 'drinks' });

    expect(screen.getByText('No drinks menu yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create drinks menu' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New menu' })).not.toBeInTheDocument();
  });

  it('@smoke renders the selected menu header and its sections', () => {
    renderPanel();

    expect(screen.getByRole('heading', { name: 'Dinner Menu' })).toBeInTheDocument();
    expect(screen.getByText('Shown to guests')).toBeInTheDocument();
    expect(screen.getByText('1 section · 1 item')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Starters/ })).toBeInTheDocument();
    expect(
      within(screen.getByRole('list', { name: 'Items in Starters' })).getByText('Burrata'),
    ).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search items' })).toBeInTheDocument();
    // A single menu needs no menu picker.
    expect(screen.queryByRole('combobox', { name: 'Menu' })).not.toBeInTheDocument();
  });

  it('@contract offers the menu picker when the catalogue has more than one menu', async () => {
    const user = userEvent.setup();
    state.hierarchyQuery = queryStub({
      data: {
        menus: [
          makeMenu(),
          makeMenu({
            id: 'menu-2',
            active: false,
            labels: [{ displayName: 'Sunday lunch', description: null, languageCode: 'en-GB' }],
            sections: [],
          }),
        ],
      },
    });
    renderPanel();

    await user.click(screen.getByRole('combobox', { name: 'Menu' }));
    await user.click(await screen.findByRole('option', { name: 'Sunday lunch (hidden)' }));

    expect(await screen.findByRole('heading', { name: 'Sunday lunch' })).toBeInTheDocument();
    expect(screen.getByText('No sections yet')).toBeInTheDocument();
    // RR8: a long menu name truncates inside the trigger and stays available via its title.
    const trigger = screen.getByRole('combobox', { name: 'Menu' });
    expect(trigger).toHaveAttribute('title', 'Sunday lunch');
    expect(trigger).toHaveClass('[&>span]:truncate');
  });

  it('@contract search and filters narrow the items and announce the count', async () => {
    const user = userEvent.setup();
    state.hierarchyQuery = queryStub({
      data: {
        menus: [
          makeMenu({
            sections: [
              makeSection({
                items: [
                  makeItem(),
                  makeItem({
                    id: 'item-2',
                    labels: [{ displayName: 'Soup', description: null, languageCode: 'en-GB' }],
                    media: { googleMediaKeys: [], localMedia: {} },
                  }),
                ],
              }),
            ],
          }),
        ],
      },
    });
    renderPanel();

    expect(screen.getByText('1 section · 2 items · 1 need attention')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Needs attention' }));
    expect(screen.getByText('Soup')).toBeInTheDocument();
    expect(screen.queryByText('Burrata')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('1 item matches');

    await user.click(screen.getByRole('radio', { name: 'All items' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search items' }), 'nothing like it');
    expect(screen.getByText('No items match')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('0 items match');
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

    await user.click(screen.getByRole('button', { name: 'Menu settings' }));

    const dialog = await screen.findByRole('dialog', { name: 'Menu settings' });
    expect(within(dialog).getByDisplayValue('Dinner Menu')).toBeInTheDocument();
  });

  it('@contract opens the create-section dialog from the header toolbar', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: 'Add section' }));

    expect(await screen.findByRole('dialog', { name: 'Add section' })).toBeInTheDocument();
  });

  it('@contract opens the delete confirmation for the selected menu', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: 'Open menu actions for Dinner Menu' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete menu' }));

    const dialog = await screen.findByRole('alertdialog', { name: 'Delete Dinner Menu?' });
    expect(within(dialog).getByText(/Publishing to Google happens separately/)).toBeInTheDocument();
  });

  it('@contract opens the item dialog scoped to a section from Add item', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: 'Add item to Starters' }));

    expect(await screen.findByRole('dialog', { name: 'Add item to Starters' })).toBeInTheDocument();
  });

  it('@contract opens the full item editor from the row Edit button', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: 'Edit Burrata' }));

    expect(await screen.findByRole('dialog', { name: 'Edit Burrata' })).toBeInTheDocument();
  });
});
