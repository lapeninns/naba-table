import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ItemTable } from '@/components/features/menu/menuHierarchyItemsTable';
import { HttpError } from '@/lib/http/errors';

import {
  makeItem,
  makeMenu,
  makeSection,
  mutationStub,
  type MutationStub,
} from './__fixtures__/menuHierarchy';

const hooks = vi.hoisted(() => ({
  patchItem: undefined as unknown as MutationStub,
}));

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('sonner', () => ({ toast: toastMock }));

vi.mock('@/hooks/ops/useOpsMenuHierarchy', () => ({
  useOpsPatchRestaurantMenuItem: () => hooks.patchItem,
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
    onEditItem: vi.fn(),
    onDeleteItem: vi.fn(),
    onCreateOption: vi.fn(),
    ...overrides,
  };
  render(<ItemTable {...props} />);
  return props;
}

function deferred() {
  let resolve: (value: unknown) => void = () => undefined;
  let reject: (reason: unknown) => void = () => undefined;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('ItemTable', () => {
  beforeEach(() => {
    hooks.patchItem = mutationStub();
    toastMock.success.mockReset();
    toastMock.error.mockReset();
  });

  it('@smoke renders every item as a row in a labelled list', () => {
    renderTable();

    const list = within(screen.getByRole('list', { name: 'Items in Starters' }));
    expect(list.getAllByRole('listitem')).toHaveLength(2);
    expect(list.getByText('Burrata')).toBeInTheDocument();
    expect(list.getByText('Soup')).toBeInTheDocument();
  });

  it('@contract renders only the visible (filtered) items', () => {
    const section = twoItemSection();
    renderTable({ section, visibleItems: [section.items[1]!], filterActive: true });

    expect(screen.queryByText('Burrata')).not.toBeInTheDocument();
    expect(screen.getByText('Soup')).toBeInTheDocument();
  });

  it('@smoke shows the empty-section copy when the section has no items', () => {
    renderTable({ section: makeSection({ items: [] }) });

    expect(screen.getByText('No items in this section yet.')).toBeInTheDocument();
  });

  it('@contract hiding an item is optimistic, patches active and offers Undo', async () => {
    const user = userEvent.setup();
    const pending = deferred();
    hooks.patchItem.mutateAsync.mockReturnValueOnce(pending.promise);
    renderTable();

    const toggle = screen.getByRole('switch', { name: 'Burrata shown on the menu' });
    await user.click(toggle);

    // Optimistic: the switch shows the new value while the save is in flight, and only this
    // item's switch is disabled.
    expect(toggle).not.toBeChecked();
    expect(toggle).toBeDisabled();
    expect(screen.getByRole('switch', { name: 'Soup shown on the menu' })).toBeEnabled();
    expect(hooks.patchItem.mutateAsync).toHaveBeenCalledWith({
      menuId: 'menu-1',
      sectionId: 'section-1',
      itemId: 'item-1',
      payload: { active: false },
    });

    pending.resolve({});
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledTimes(1));
    const [message, options] = toastMock.success.mock.calls[0]!;
    expect(message).toBe('Burrata hidden from the menu.');
    expect(options.action.label).toBe('Undo');

    options.action.onClick();
    await waitFor(() => expect(hooks.patchItem.mutateAsync).toHaveBeenCalledTimes(2));
    expect(hooks.patchItem.mutateAsync).toHaveBeenLastCalledWith({
      menuId: 'menu-1',
      sectionId: 'section-1',
      itemId: 'item-1',
      payload: { active: true },
    });
    await waitFor(() => expect(toastMock.success).toHaveBeenCalledTimes(2));
    // The undo confirmation does not offer a second Undo.
    expect(toastMock.success.mock.calls[1]).toEqual(['Burrata shown on the menu.', undefined]);
  });

  it('@contract rolls the switch back and names the reason code when the save fails', async () => {
    const user = userEvent.setup();
    hooks.patchItem.mutateAsync.mockRejectedValueOnce(
      new HttpError({ message: 'Burrata guest data', status: 409, code: 'HTTP_409' }),
    );
    renderTable();

    const toggle = screen.getByRole('switch', { name: 'Burrata shown on the menu' });
    await user.click(toggle);

    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith(
        'Could not hide Burrata. It is still shown. Reason code HTTP_409.',
      ),
    );
    expect(toggle).toBeChecked();
    expect(toggle).toBeEnabled();
    expect(toastMock.success).not.toHaveBeenCalled();
  });

  it('@contract moving an item down swaps display orders in two patches', async () => {
    const user = userEvent.setup();
    renderTable();

    await user.click(screen.getByRole('button', { name: 'Open item actions for Burrata' }));
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

  it('@contract quick edit stays available and saves a patch for the item', async () => {
    const user = userEvent.setup();
    renderTable();

    await user.click(screen.getByRole('button', { name: 'Open item actions for Burrata' }));
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
    expect(toastMock.success).toHaveBeenCalledWith('Burrata updated.');
  });

  it('@contract Add option from the row menu flows to the option callback', async () => {
    const user = userEvent.setup();
    const props = renderTable();

    await user.click(screen.getByRole('button', { name: 'Open item actions for Soup' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Add option' }));

    expect(props.onCreateOption).toHaveBeenCalledWith(expect.objectContaining({ id: 'item-2' }));
  });
});
