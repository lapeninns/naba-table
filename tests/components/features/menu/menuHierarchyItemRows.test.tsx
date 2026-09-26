import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  ItemActions,
  MenuItemRow,
  OptionRow,
} from '@/components/features/menu/menuHierarchyItemRows';

import { makeItem, makeOption } from './__fixtures__/menuHierarchy';

import type { DualSyncFieldSummary } from '@/services/ops/dual-sync';

function renderItemRow(overrides: Partial<Parameters<typeof MenuItemRow>[0]> = {}) {
  const props = {
    item: makeItem(),
    itemIndex: 0,
    itemsCount: 2,
    driftField: null,
    togglePending: false,
    moveDisabled: false,
    onToggleActive: vi.fn(),
    onEditItem: vi.fn(),
    onQuickEditItem: vi.fn(),
    onCreateOption: vi.fn(),
    onMoveItem: vi.fn().mockResolvedValue(undefined),
    onDeleteItem: vi.fn(),
    ...overrides,
  };
  render(
    <ul>
      <MenuItemRow {...props} />
    </ul>,
  );
  return props;
}

describe('MenuItemRow', () => {
  it('@smoke shows name, description, price, services and Google readiness', () => {
    renderItemRow({
      item: makeItem({
        attributes: {
          ...makeItem().attributes,
          allergen: ['MILK', 'GLUTEN'],
          dietaryRestriction: ['VEGETARIAN'],
        },
      }),
    });

    const row = within(screen.getByRole('listitem'));
    expect(row.getByText('Burrata')).toBeInTheDocument();
    expect(row.getByText('Creamy starter')).toHaveClass('line-clamp-2');
    expect(row.getByText('Vegetarian')).toBeInTheDocument();
    expect(row.getByText('Allergens: Milk, Gluten')).toBeInTheDocument();
    expect(row.getByText(/£9.50/)).toBeInTheDocument();
    expect(row.getByText(/All services/)).toBeInTheDocument();
    expect(row.getByText('Ready for Google')).toBeInTheDocument();
    expect(row.queryByText('Sold out')).not.toBeInTheDocument();
    expect(row.queryByText('Differs from Google')).not.toBeInTheDocument();
  });

  it('@contract names what is missing for Google and the named services', () => {
    renderItemRow({
      item: makeItem({
        attributes: { ...makeItem().attributes, price: null },
        media: { googleMediaKeys: [], localMedia: {} },
        extensions: { availabilityPolicy: { servicePeriods: ['lunch', 'dinner'] } },
      }),
    });

    expect(screen.getByText('Needs price and photo for Google')).toBeInTheDocument();
    expect(screen.getByText(/Lunch, Dinner/)).toBeInTheDocument();
    expect(screen.getByText(/No price/)).toBeInTheDocument();
  });

  it('@contract shows Sold out and Differs from Google badges with text', () => {
    renderItemRow({
      item: makeItem({ extensions: { availabilityPolicy: { soldOut: true } } }),
      driftField: {
        fieldKey: 'foodMenus.items.burrata',
        sectionKey: 'foodMenus',
        label: 'Burrata',
      } as DualSyncFieldSummary,
    });

    expect(screen.getByText('Sold out')).toBeInTheDocument();
    expect(screen.getByText('Differs from Google')).toBeInTheDocument();
  });

  it('@contract @a11y the shown switch is named by the item and reports its state', async () => {
    const user = userEvent.setup();
    const props = renderItemRow({ item: makeItem({ active: false }) });

    const toggle = screen.getByRole('switch', { name: 'Burrata shown on the menu' });
    expect(toggle).not.toBeChecked();
    expect(screen.getByText('Hidden')).toBeInTheDocument();
    expect(screen.getByText('Hidden from menu')).toBeInTheDocument();

    await user.click(toggle);
    expect(props.onToggleActive).toHaveBeenCalledWith(props.item, true);
  });

  it('@contract disables only this switch while its change is saving', () => {
    renderItemRow({ togglePending: true });

    expect(screen.getByRole('switch', { name: 'Burrata shown on the menu' })).toBeDisabled();
  });

  it('@contract @a11y Edit opens the full editor and is named by the item', async () => {
    const user = userEvent.setup();
    const props = renderItemRow();

    await user.click(screen.getByRole('button', { name: 'Edit Burrata' }));
    expect(props.onEditItem).toHaveBeenCalledWith(props.item);
  });
});

describe('ItemActions', () => {
  function renderActions(overrides: Partial<Parameters<typeof ItemActions>[0]> = {}) {
    const props = {
      item: makeItem(),
      itemIndex: 1,
      itemsCount: 3,
      moveDisabled: false,
      onQuickEditItem: vi.fn(),
      onCreateOption: vi.fn(),
      onMoveItem: vi.fn().mockResolvedValue(undefined),
      onDeleteItem: vi.fn(),
      ...overrides,
    };
    render(<ItemActions {...props} />);
    return props;
  }

  it('@contract @a11y opens the labelled menu and fires quick edit, add option, and delete', async () => {
    const user = userEvent.setup();
    const props = renderActions();

    await user.click(screen.getByRole('button', { name: 'Open item actions for Burrata' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Quick edit' }));
    expect(props.onQuickEditItem).toHaveBeenCalledWith(props.item);

    await user.click(screen.getByRole('button', { name: 'Open item actions for Burrata' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Add option' }));
    expect(props.onCreateOption).toHaveBeenCalledWith(props.item);

    await user.click(screen.getByRole('button', { name: 'Open item actions for Burrata' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete item' }));
    expect(props.onDeleteItem).toHaveBeenCalledWith(props.item);
  });

  it('@contract moves the item and disables the impossible direction', async () => {
    const user = userEvent.setup();
    const props = renderActions({ itemIndex: 0 });

    await user.click(screen.getByRole('button', { name: 'Open item actions for Burrata' }));
    const moveUp = await screen.findByRole('menuitem', { name: 'Move item up' });
    expect(moveUp).toHaveAttribute('aria-disabled', 'true');

    await user.click(screen.getByRole('menuitem', { name: 'Move item down' }));
    expect(props.onMoveItem).toHaveBeenCalledWith(props.item, 0, 1);
  });

  it('@contract turns reordering off while a filter hides neighbours', async () => {
    const user = userEvent.setup();
    renderActions({ moveDisabled: true });

    await user.click(screen.getByRole('button', { name: 'Open item actions for Burrata' }));
    expect(await screen.findByRole('menuitem', { name: 'Move item up' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByRole('menuitem', { name: 'Move item down' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });
});

describe('OptionRow', () => {
  function renderRow(overrides: Partial<Parameters<typeof OptionRow>[0]> = {}) {
    const props = {
      item: makeItem(),
      option: makeOption(),
      optionIndex: 0,
      optionsCount: 2,
      onEditOption: vi.fn(),
      onMoveOption: vi.fn().mockResolvedValue(undefined),
      onRemoveOption: vi.fn().mockResolvedValue(undefined),
      patchPending: false,
      ...overrides,
    };
    render(<OptionRow {...props} />);
    return props;
  }

  it('@smoke shows the option label with its formatted price', () => {
    renderRow();

    expect(screen.getByText('Extra bread')).toBeInTheDocument();
    expect(screen.getByText('£2.00')).toBeInTheDocument();
  });

  it('@smoke marks inactive options', () => {
    renderRow({ option: makeOption({ active: false }) });

    expect(screen.getByText('Hidden')).toBeInTheDocument();
  });

  it('@contract @a11y edits via the labelled button and deletes via the menu', async () => {
    const user = userEvent.setup();
    const props = renderRow();

    await user.click(screen.getByRole('button', { name: 'Edit option Extra bread' }));
    expect(props.onEditOption).toHaveBeenCalledWith(props.item, props.option);

    await user.click(screen.getByRole('button', { name: 'Open option actions for Extra bread' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete option' }));
    expect(props.onRemoveOption).toHaveBeenCalledWith(props.item, props.option);
  });

  it('@contract moves options and disables the boundary direction', async () => {
    const user = userEvent.setup();
    const props = renderRow({ optionIndex: 1, optionsCount: 2 });

    await user.click(screen.getByRole('button', { name: 'Open option actions for Extra bread' }));
    const moveDown = await screen.findByRole('menuitem', { name: 'Move option down' });
    expect(moveDown).toHaveAttribute('aria-disabled', 'true');

    await user.click(screen.getByRole('menuitem', { name: 'Move option up' }));
    expect(props.onMoveOption).toHaveBeenCalledWith(props.item, props.option, 1, -1);
  });
});
