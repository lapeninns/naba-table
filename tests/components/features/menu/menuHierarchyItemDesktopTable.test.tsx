import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DesktopItemTable } from '@/components/features/menu/menuHierarchyItemDesktopTable';

import { makeItem, makeSection } from './__fixtures__/menuHierarchy';

import type { ItemTableViewProps } from '@/components/features/menu/menuHierarchyItemTableShared';

function renderTable(overrides: Partial<ItemTableViewProps> = {}) {
  const props: ItemTableViewProps = {
    section: makeSection(),
    itemPatchPending: false,
    optionPatchPending: false,
    getItemGbpDriftFields: () => [],
    onCreateItem: vi.fn(),
    onCreateOption: vi.fn(),
    onDeleteItem: vi.fn(),
    onDeleteOption: vi.fn().mockResolvedValue(undefined),
    onEditItem: vi.fn(),
    onEditOption: vi.fn(),
    onMoveItem: vi.fn().mockResolvedValue(undefined),
    onMoveOption: vi.fn().mockResolvedValue(undefined),
    onQuickEditItem: vi.fn(),
    onToggleItemActive: vi.fn(),
    ...overrides,
  };
  render(<DesktopItemTable {...props} />);
  return props;
}

describe('DesktopItemTable', () => {
  it('@smoke @a11y renders the item row with price, badges, and column headers', () => {
    renderTable();

    const table = within(screen.getByRole('table'));
    for (const header of ['Item details', 'Price', 'Availability', 'Status', 'Actions']) {
      expect(table.getByText(header)).toBeInTheDocument();
    }
    expect(table.getByText('Burrata')).toBeInTheDocument();
    expect(table.getByText('Creamy starter')).toBeInTheDocument();
    expect(table.getByText('£9.50')).toBeInTheDocument();
    expect(table.getByText('All services')).toBeInTheDocument();
  });

  it('@contract clicking the item name opens the full editor', async () => {
    const user = userEvent.setup();
    const props = renderTable();

    await user.click(screen.getByRole('button', { name: 'Burrata' }));

    expect(props.onEditItem).toHaveBeenCalledWith(expect.objectContaining({ id: 'item-1' }));
  });

  it('@contract @a11y the status switch reflects and toggles the active flag', async () => {
    const user = userEvent.setup();
    const props = renderTable({
      section: makeSection({ items: [makeItem({ active: false })] }),
    });

    const control = screen.getByRole('switch', { name: 'Set Burrata active' });
    expect(control).not.toBeChecked();

    await user.click(control);
    expect(props.onToggleItemActive).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'item-1' }),
      true,
    );
  });

  it('@contract disables the switch while a patch is pending', () => {
    renderTable({ itemPatchPending: true });

    expect(screen.getByRole('switch', { name: 'Set Burrata active' })).toBeDisabled();
  });

  it('@contract shows the formatted no-price fallback', () => {
    renderTable({
      section: makeSection({
        items: [makeItem({ attributes: { ...makeItem().attributes, price: null } })],
      }),
    });

    expect(screen.getByText('No price')).toBeInTheDocument();
  });
});
