import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ItemDialog } from '@/components/features/menu/menuHierarchyItemDialog';
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
  createItem: undefined as unknown as MutationStub,
  updateItem: undefined as unknown as MutationStub,
  patchOption: undefined as unknown as MutationStub,
}));

vi.mock('@/hooks/ops/useOpsMenuHierarchy', () => ({
  useOpsCreateRestaurantMenuItem: () => hooks.createItem,
  useOpsUpdateRestaurantMenuItem: () => hooks.updateItem,
  useOpsPatchRestaurantMenuOption: () => hooks.patchOption,
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
    hooks.patchOption = mutationStub();
  });

  it('@smoke @a11y keeps essentials visible and less-used groups collapsed', () => {
    renderDialog();

    expect(screen.getByRole('dialog', { name: 'Add item to Starters' })).toBeInTheDocument();
    expect(screen.getByText('Item name')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Price' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Dietary' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Allergens' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Availability' })).toBeInTheDocument();

    for (const name of [/Options guests can choose/, /Google details/, /More/]) {
      expect(screen.getByRole('button', { name })).toHaveAttribute('aria-expanded', 'false');
    }
    expect(screen.queryByRole('button', { name: /Drink details/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Preparation methods')).not.toBeInTheDocument();
  });

  it('@contract every existing field group is still reachable through the disclosures', async () => {
    const user = userEvent.setup();
    renderDialog({ item: makeItem() });

    await user.click(screen.getByRole('button', { name: /Google details/ }));
    for (const text of [
      'Google photo keys',
      'Manual paste fallback',
      'Local image URL',
      'Spiciness',
      'Serves',
      'Preparation methods',
      'Ingredients',
      'Guest menu portion size',
      'Google nutrition facts',
      'Primary label language',
      'Additional Google labels',
    ]) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }

    await user.click(screen.getByRole('button', { name: /More/ }));
    for (const name of [
      'Availability details',
      'Recommendations',
      'Customisation',
      'Import metadata',
    ]) {
      expect(screen.getByRole('heading', { name })).toBeInTheDocument();
    }
    expect(screen.getByText('Availability status')).toBeInTheDocument();
    expect(screen.getByText('Orderable')).toBeInTheDocument();
  });

  it('@contract shows drink details only for drinks menus, open by default', () => {
    renderDialog({ menu: makeMenu({ menuKind: 'drinks' }) });

    expect(screen.getByRole('button', { name: /Drink details/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByText('ABV %')).toBeInTheDocument();
  });

  it('@contract titles as edit and prefills when an item is provided', () => {
    renderDialog({ item: makeItem() });

    expect(screen.getByRole('dialog', { name: 'Edit Burrata' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Burrata')).toBeInTheDocument();
  });

  it('@contract rejects URL-looking media keys with an inline error', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole('button', { name: /Google details/ }));
    await user.type(
      screen.getByPlaceholderText('locations/{locationId}/media/{mediaKey}'),
      'https://example.com/image.jpg',
    );
    await user.click(screen.getByRole('button', { name: 'Add' }));

    expect(screen.getByText('Google media keys cannot be image URLs.')).toBeInTheDocument();
    expect(screen.getByText('No GBP media keys selected.')).toBeInTheDocument();
  });

  it('@contract opens Google details to show a media key error found on save', async () => {
    const user = userEvent.setup();
    renderDialog({
      item: makeItem({ media: { googleMediaKeys: ['https://example.com/a.jpg'], localMedia: {} } }),
    });

    await user.click(screen.getByRole('button', { name: 'Save item' }));

    expect(screen.getByRole('button', { name: /Google details/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(
      screen.getByText(
        'Google media keys cannot be image URLs. Put local URLs in the local image field.',
      ),
    ).toBeInTheDocument();
    expect(hooks.updateItem.mutateAsync).not.toHaveBeenCalled();
  });

  it('@contract adds and removes media keys as badges', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole('button', { name: /Google details/ }));
    const draft = screen.getByPlaceholderText('locations/{locationId}/media/{mediaKey}');
    await user.type(draft, 'locations/1/media/abc');
    await user.click(screen.getByRole('button', { name: 'Add' }));

    const removeButton = screen.getByRole('button', { name: 'Remove locations/1/media/abc' });
    expect(removeButton).toBeInTheDocument();
    expect(screen.queryByText('No GBP media keys selected.')).not.toBeInTheDocument();

    await user.click(removeButton);
    expect(screen.getByText('No GBP media keys selected.')).toBeInTheDocument();
  });

  it('@contract options list the live item options and open the option dialogs', async () => {
    const user = userEvent.setup();
    const optionCallbacks = {
      onCreateOption: vi.fn(),
      onEditOption: vi.fn(),
      onDeleteOption: vi.fn(),
    };
    const item = makeItem();
    const liveItem = makeItem({ options: [makeOption()] });
    renderDialog({ item, liveItem, optionCallbacks });

    const disclosure = screen.getByRole('button', { name: /Options guests can choose/ });
    expect(disclosure).toHaveTextContent('1 option');
    await user.click(disclosure);

    await user.click(screen.getByRole('button', { name: 'Edit option Extra bread' }));
    expect(optionCallbacks.onEditOption).toHaveBeenCalledWith(liveItem, liveItem.options[0]);

    await user.click(screen.getByRole('button', { name: 'Add option' }));
    expect(optionCallbacks.onCreateOption).toHaveBeenCalledWith(liveItem);
  });

  it('@contract a new item explains options come after the first save', async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole('button', { name: /Options guests can choose/ }));
    expect(
      screen.getByText('Save the item first, then add options such as a large portion.'),
    ).toBeInTheDocument();
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

    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
  });

  it('@contract surfaces mutation errors inside the dialog with the reason code only', () => {
    hooks.createItem = mutationStub({
      error: new HttpError({ message: 'Save failed hard', status: 500, code: 'HTTP_500' }),
    });
    renderDialog();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Not saved. Your edits are still in this dialog. Reason code HTTP_500.',
    );
    expect(screen.queryByText(/Save failed hard/)).not.toBeInTheDocument();
  });

  it('@contract cancel closes without saving', async () => {
    const user = userEvent.setup();
    const props = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(props.onOpenChange).toHaveBeenCalledWith(false);
    expect(hooks.createItem.mutateAsync).not.toHaveBeenCalled();
  });
});
