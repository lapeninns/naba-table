import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DeleteHierarchyDialog,
  type MenuHierarchyDeleteTarget,
} from '@/components/features/menu/menuHierarchyDeleteDialog';
import { HttpError } from '@/lib/http/errors';

import {
  makeItem,
  makeMenu,
  makeOption,
  makeSection,
  mutationStub,
  type MutationStub,
} from './__fixtures__/menuHierarchy';

const hooks = vi.hoisted(() => ({
  deleteMenu: undefined as unknown as MutationStub,
  deleteSection: undefined as unknown as MutationStub,
  deleteItem: undefined as unknown as MutationStub,
  deleteOption: undefined as unknown as MutationStub,
}));

vi.mock('@/hooks/ops/useOpsMenuHierarchy', () => ({
  useOpsDeleteRestaurantMenu: () => hooks.deleteMenu,
  useOpsDeleteRestaurantMenuSection: () => hooks.deleteSection,
  useOpsDeleteRestaurantMenuItem: () => hooks.deleteItem,
  useOpsDeleteRestaurantMenuOption: () => hooks.deleteOption,
}));

function renderDialog(target: MenuHierarchyDeleteTarget | null) {
  const onOpenChange = vi.fn();
  render(
    <DeleteHierarchyDialog restaurantId="rest-1" target={target} onOpenChange={onOpenChange} />,
  );
  return { onOpenChange };
}

describe('DeleteHierarchyDialog', () => {
  beforeEach(() => {
    hooks.deleteMenu = mutationStub();
    hooks.deleteSection = mutationStub();
    hooks.deleteItem = mutationStub();
    hooks.deleteOption = mutationStub();
  });

  it('@smoke stays closed without a target', () => {
    renderDialog(null);

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('@contract clears a stale delete error when opened for a new target', () => {
    renderDialog(null);
    expect(hooks.deleteMenu.reset).not.toHaveBeenCalled();

    renderDialog({ type: 'section', menu: makeMenu(), section: makeSection() });

    for (const stub of [
      hooks.deleteMenu,
      hooks.deleteSection,
      hooks.deleteItem,
      hooks.deleteOption,
    ]) {
      expect(stub.reset).toHaveBeenCalledTimes(1);
    }
  });

  it('@contract @a11y names the menu target and deletes it on confirm', async () => {
    const user = userEvent.setup();
    const menu = makeMenu();
    const { onOpenChange } = renderDialog({ type: 'menu', menu });

    expect(screen.getByRole('alertdialog', { name: 'Delete Dinner Menu?' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'Dinner Menu, its 1 section and their items are deleted from Nabatable. This can’t be undone. Publishing to Google happens separately.',
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete menu' }));

    expect(hooks.deleteMenu.mutateAsync).toHaveBeenCalledWith({ menuId: 'menu-1' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('@contract deletes a section with menu and section ids', async () => {
    const user = userEvent.setup();
    renderDialog({ type: 'section', menu: makeMenu(), section: makeSection() });

    expect(
      screen.getByText(
        /Starters and its 1 item are deleted from this menu\. This can’t be undone\./,
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete section' }));

    expect(hooks.deleteSection.mutateAsync).toHaveBeenCalledWith({
      menuId: 'menu-1',
      sectionId: 'section-1',
    });
    expect(hooks.deleteMenu.mutateAsync).not.toHaveBeenCalled();
  });

  it('@contract deletes an item and an option with the full id path', async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderDialog({
      type: 'option',
      menu: makeMenu(),
      section: makeSection(),
      item: makeItem(),
      option: makeOption(),
    });

    expect(screen.getByText(/Extra bread is removed from Burrata\./)).toBeInTheDocument();
    expect(screen.getByText(/Publishing to Google happens separately\./)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete option' }));

    expect(hooks.deleteOption.mutateAsync).toHaveBeenCalledWith({
      menuId: 'menu-1',
      sectionId: 'section-1',
      itemId: 'item-1',
      optionId: 'option-1',
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('@contract disables actions and shows progress while a delete is pending', () => {
    hooks.deleteItem = mutationStub({ isPending: true });
    renderDialog({
      type: 'item',
      menu: makeMenu(),
      section: makeSection(),
      item: makeItem(),
    });

    expect(screen.getByRole('button', { name: 'Deleting…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });

  it('@contract surfaces a delete failure with the reason code, not the raw message', () => {
    hooks.deleteMenu = mutationStub({
      error: new HttpError({ message: 'Delete rejected', status: 409, code: 'HTTP_409' }),
    });
    renderDialog({ type: 'menu', menu: makeMenu() });

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Not deleted. Nothing was removed. Reason code HTTP_409.',
    );
    expect(screen.queryByText(/Delete rejected/)).not.toBeInTheDocument();
  });
});
