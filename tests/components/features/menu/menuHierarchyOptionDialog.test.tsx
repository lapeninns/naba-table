import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OptionDialog } from '@/components/features/menu/menuHierarchyOptionDialog';

import {
  makeItem,
  makeMenu,
  makeOption,
  makeSection,
  mutationStub,
  type MutationStub,
} from './__fixtures__/menuHierarchy';

const hooks = vi.hoisted(() => ({
  createOption: undefined as unknown as MutationStub,
  updateOption: undefined as unknown as MutationStub,
}));

vi.mock('@/hooks/ops/useOpsMenuHierarchy', () => ({
  useOpsCreateRestaurantMenuOption: () => hooks.createOption,
  useOpsUpdateRestaurantMenuOption: () => hooks.updateOption,
}));

function renderDialog(overrides: Partial<Parameters<typeof OptionDialog>[0]> = {}) {
  const props = {
    restaurantId: 'rest-1',
    menu: makeMenu(),
    section: makeSection(),
    item: makeItem(),
    option: null,
    onOpenChange: vi.fn(),
    ...overrides,
  };
  render(<OptionDialog {...props} />);
  return props;
}

describe('OptionDialog', () => {
  beforeEach(() => {
    hooks.createOption = mutationStub();
    hooks.updateOption = mutationStub();
  });

  it('@smoke stays closed without a parent item', () => {
    renderDialog({ item: null });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('@smoke @a11y renders the add-option dialog with the parent summary', () => {
    renderDialog();

    expect(screen.getByRole('dialog', { name: 'Add item option' })).toBeInTheDocument();
    expect(screen.getByText('Burrata')).toBeInTheDocument();
    expect(screen.getByText('0 existing options')).toBeInTheDocument();
    expect(screen.getByText('Option Google attributes')).toBeInTheDocument();
    expect(screen.getByText('Option media keys')).toBeInTheDocument();
  });

  it('@contract creating an option saves the built payload and closes', async () => {
    const user = userEvent.setup();
    const props = renderDialog();

    const [nameInput] = screen.getAllByRole('textbox');
    await user.type(nameInput, 'Large');
    await user.click(screen.getByRole('button', { name: 'Add option' }));

    await waitFor(() => expect(hooks.createOption.mutateAsync).toHaveBeenCalledTimes(1));
    const variables = hooks.createOption.mutateAsync.mock.calls[0][0];
    expect(variables).toMatchObject({ menuId: 'menu-1', sectionId: 'section-1', itemId: 'item-1' });
    expect(variables.payload.labels[0].displayName).toBe('Large');
    // The server appends new options (max + 1); the client sends no display order.
    expect(variables.payload).not.toHaveProperty('displayOrder');
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('@contract editing an option routes through the patch mutation with ids', async () => {
    const user = userEvent.setup();
    renderDialog({ option: makeOption() });

    expect(screen.getByRole('dialog', { name: 'Edit item option' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Extra bread')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save option' }));

    await waitFor(() => expect(hooks.updateOption.mutateAsync).toHaveBeenCalledTimes(1));
    expect(hooks.updateOption.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        menuId: 'menu-1',
        sectionId: 'section-1',
        itemId: 'item-1',
        optionId: 'option-1',
      }),
    );
    expect(hooks.createOption.mutateAsync).not.toHaveBeenCalled();
  });

  it('@contract disables submit while pending and surfaces errors', () => {
    hooks.createOption = mutationStub({
      isPending: true,
      error: new Error('Option save failed'),
    });
    renderDialog();

    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Not saved. Your edits are still in this dialog.',
    );
    expect(screen.queryByText(/Option save failed/)).not.toBeInTheDocument();
  });

  it('@contract clears a previous save error when the dialog opens', () => {
    renderDialog();

    expect(hooks.createOption.reset).toHaveBeenCalled();
    expect(hooks.updateOption.reset).toHaveBeenCalled();
  });

  it('@contract editing sends no display order, so a concurrent reorder is kept', async () => {
    const user = userEvent.setup();
    renderDialog({ option: makeOption({ displayOrder: 3 }) });

    await user.click(screen.getByRole('button', { name: 'Save option' }));

    await waitFor(() => expect(hooks.updateOption.mutateAsync).toHaveBeenCalledTimes(1));
    expect(hooks.updateOption.mutateAsync.mock.calls[0][0].payload).not.toHaveProperty(
      'displayOrder',
    );
  });

  it('@contract cancel closes without mutating', async () => {
    const user = userEvent.setup();
    const props = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(props.onOpenChange).toHaveBeenCalledWith(false);
    expect(hooks.createOption.mutateAsync).not.toHaveBeenCalled();
  });
});
