import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ItemDialog } from '@/components/features/menu/menuHierarchyItemDialog';

import {
  makeItem,
  makeMenu,
  makeSection,
  mutationStub,
  type MutationStub,
} from './__fixtures__/menuHierarchy';

const hooks = vi.hoisted(() => ({
  createItem: undefined as unknown as MutationStub,
  updateItem: undefined as unknown as MutationStub,
}));

vi.mock('@/hooks/ops/useOpsMenuHierarchy', () => ({
  useOpsCreateRestaurantMenuItem: () => hooks.createItem,
  useOpsUpdateRestaurantMenuItem: () => hooks.updateItem,
}));

function renderDialog(overrides: Partial<Parameters<typeof ItemDialog>[0]> = {}) {
  const props = {
    restaurantId: 'rest-1',
    menu: makeMenu(),
    section: makeSection(),
    item: null,
    open: true,
    onOpenChange: vi.fn(),
    ...overrides,
  };
  render(<ItemDialog {...props} />);
  return props;
}

describe('ItemDialog', () => {
  beforeEach(() => {
    hooks.createItem = mutationStub();
    hooks.updateItem = mutationStub();
  });

  it('@smoke @a11y renders the create dialog with grouped field sections', () => {
    renderDialog();

    expect(screen.getByRole('dialog', { name: 'Create item' })).toBeInTheDocument();
    expect(screen.getByText('Essentials')).toBeInTheDocument();
    expect(screen.getByText('Google publishing')).toBeInTheDocument();
    expect(screen.getByText('Guest menu')).toBeInTheDocument();
    expect(screen.getByText('Recommendations')).toBeInTheDocument();
    expect(screen.getByText('Customization')).toBeInTheDocument();
    expect(screen.getByText('Import metadata')).toBeInTheDocument();
    expect(screen.queryByText('Drink details')).not.toBeInTheDocument();
  });

  it('@contract shows drink details only for drinks menus', () => {
    renderDialog({ menu: makeMenu({ menuKind: 'drinks' }) });

    expect(screen.getByText('Drink details')).toBeInTheDocument();
  });

  it('@contract titles as edit and prefills when an item is provided', () => {
    renderDialog({ item: makeItem() });

    expect(screen.getByRole('dialog', { name: 'Edit item' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Burrata')).toBeInTheDocument();
  });

  it('@contract rejects URL-looking media keys with an inline error', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.type(
      screen.getByPlaceholderText('locations/{locationId}/media/{mediaKey}'),
      'https://example.com/image.jpg',
    );
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(screen.getByText('Google media keys cannot be image URLs.')).toBeInTheDocument();
    expect(screen.getByText('No GBP media keys selected.')).toBeInTheDocument();
  });

  it('@contract adds and removes media keys as badges', async () => {
    const user = userEvent.setup();
    renderDialog();

    const draft = screen.getByPlaceholderText('locations/{locationId}/media/{mediaKey}');
    await user.type(draft, 'locations/1/media/abc');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    const removeButton = screen.getByRole('button', { name: 'Remove locations/1/media/abc' });
    expect(removeButton).toBeInTheDocument();
    expect(screen.queryByText('No GBP media keys selected.')).not.toBeInTheDocument();

    await user.click(removeButton);
    expect(screen.getByText('No GBP media keys selected.')).toBeInTheDocument();
  });

  it('@contract creating an item saves a payload built from the form and closes', async () => {
    const user = userEvent.setup();
    const props = renderDialog();

    const [nameInput] = screen.getAllByRole('textbox');
    await user.type(nameInput, 'Focaccia');
    await user.click(screen.getByRole('button', { name: 'Save item' }));

    await waitFor(() => expect(hooks.createItem.mutateAsync).toHaveBeenCalledTimes(1));
    const payload = hooks.createItem.mutateAsync.mock.calls[0][0];
    expect(payload.labels[0].displayName).toBe('Focaccia');
    expect(payload.displayOrder).toBe(1);
    expect(hooks.updateItem.mutateAsync).not.toHaveBeenCalled();
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('@contract editing an existing item routes through the update mutation', async () => {
    const user = userEvent.setup();
    renderDialog({ item: makeItem() });

    await user.click(screen.getByRole('button', { name: 'Save item' }));

    await waitFor(() => expect(hooks.updateItem.mutateAsync).toHaveBeenCalledTimes(1));
    const payload = hooks.updateItem.mutateAsync.mock.calls[0][0];
    expect(payload.labels[0].displayName).toBe('Burrata');
    expect(hooks.createItem.mutateAsync).not.toHaveBeenCalled();
  });

  it('@contract blocks submit while pending and without a section', () => {
    hooks.createItem = mutationStub({ isPending: true });
    renderDialog();

    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
  });

  it('@contract surfaces mutation errors inside the dialog', () => {
    hooks.createItem = mutationStub({ error: new Error('Save failed hard') });
    renderDialog();

    expect(screen.getByText('Save failed hard')).toBeInTheDocument();
  });

  it('@contract cancel closes without saving', async () => {
    const user = userEvent.setup();
    const props = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(props.onOpenChange).toHaveBeenCalledWith(false);
    expect(hooks.createItem.mutateAsync).not.toHaveBeenCalled();
  });
});
