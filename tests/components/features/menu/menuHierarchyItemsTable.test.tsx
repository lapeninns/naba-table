import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ItemTable } from '@/components/features/menu/menuHierarchyItemsTable';

import {
  makeItem,
  makeMenu,
  makeOption,
  makeSection,
  mutationStub,
  type MutationStub,
} from './__fixtures__/menuHierarchy';

const hooks = vi.hoisted(() => ({
  patchItem: undefined as unknown as MutationStub,
  patchOption: undefined as unknown as MutationStub,
}));

vi.mock('@/hooks/ops/useOpsMenuHierarchy', () => ({
  useOpsPatchRestaurantMenuItem: () => hooks.patchItem,
  useOpsPatchRestaurantMenuOption: () => hooks.patchOption,
}));

const twoItemSection = () =>
  makeSection({
    items: [
      makeItem({ id: 'item-1', displayOrder: 1 }),
      makeItem({
        id: 'item-2',
        displayOrder: 2,
        labels: [{ displayName: 'Soup', description: null, languageCode: 'en-GB' }],
      }),
    ],
  });

function renderTable(overrides: Partial<Parameters<typeof ItemTable>[0]> = {}) {
  const props = {
    restaurantId: 'rest-1',
    menu: makeMenu(),
    section: twoItemSection(),
    gbpDriftFields: [],
    onCreateItem: vi.fn(),
    onEditItem: vi.fn(),
    onDeleteItem: vi.fn(),
    onCreateOption: vi.fn(),
    onEditOption: vi.fn(),
    onDeleteOption: vi.fn(),
    ...overrides,
  };
  render(<ItemTable {...props} />);
  return props;
}

describe('ItemTable', () => {
  beforeEach(() => {
    hooks.patchItem = mutationStub();
    hooks.patchOption = mutationStub();
  });

  it('@smoke renders both items in the desktop table', () => {
    renderTable();

    const table = within(screen.getByRole('table'));
    expect(table.getByText('Burrata')).toBeInTheDocument();
    expect(table.getByText('Soup')).toBeInTheDocument();
  });

  it('@contract toggling the status switch patches the item active flag', async () => {
    const user = userEvent.setup();
    renderTable();

    const table = within(screen.getByRole('table'));
    await user.click(table.getByRole('switch', { name: 'Set Burrata active' }));

    await waitFor(() =>
      expect(hooks.patchItem.mutateAsync).toHaveBeenCalledWith({
        menuId: 'menu-1',
        sectionId: 'section-1',
        itemId: 'item-1',
        payload: { active: false },
      }),
    );
  });

  it('@contract moving an item down swaps display orders in two patches', async () => {
    const user = userEvent.setup();
    renderTable();

    const table = within(screen.getByRole('table'));
    await user.click(table.getByRole('button', { name: 'Open item actions for Burrata' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Move item down' }));

    await waitFor(() => expect(hooks.patchItem.mutateAsync).toHaveBeenCalledTimes(2));
    expect(hooks.patchItem.mutateAsync).toHaveBeenCalledWith({
      menuId: 'menu-1',
      sectionId: 'section-1',
      itemId: 'item-1',
      payload: { displayOrder: 2 },
    });
    expect(hooks.patchItem.mutateAsync).toHaveBeenCalledWith({
      menuId: 'menu-1',
      sectionId: 'section-1',
      itemId: 'item-2',
      payload: { displayOrder: 1 },
    });
  });

  it('@contract quick edit opens the dialog and saves a patch for the item', async () => {
    const user = userEvent.setup();
    renderTable();

    const table = within(screen.getByRole('table'));
    await user.click(table.getByRole('button', { name: 'Open item actions for Burrata' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Quick edit' }));

    const dialog = await screen.findByRole('dialog', { name: 'Quick edit item' });
    await user.click(within(dialog).getByRole('button', { name: 'Save quick edit' }));

    await waitFor(() =>
      expect(hooks.patchItem.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ itemId: 'item-1', menuId: 'menu-1', sectionId: 'section-1' }),
      ),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Quick edit item' })).not.toBeInTheDocument(),
    );
  });

  it('@contract delete option requests flow to the delete callback, not a patch', async () => {
    const user = userEvent.setup();
    const props = renderTable({
      section: makeSection({ items: [makeItem({ options: [makeOption()] })] }),
    });

    const table = within(screen.getByRole('table'));
    await user.click(table.getByRole('button', { name: 'Open option actions for Extra bread' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete option' }));

    expect(props.onDeleteOption).toHaveBeenCalledTimes(1);
    expect(hooks.patchOption.mutateAsync).not.toHaveBeenCalled();
  });
});
