import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { MenuItemResponsiveViews } from '@/components/features/menu/menuHierarchyItemTableViews';

import { makeItem, makeSection } from './__fixtures__/menuHierarchy';

import type { ItemTableViewProps } from '@/components/features/menu/menuHierarchyItemTableShared';

function renderViews(overrides: Partial<ItemTableViewProps> = {}) {
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
  render(<MenuItemResponsiveViews {...props} />);
  return props;
}

describe('MenuItemResponsiveViews', () => {
  it('@contract shows the empty state and creates the first item from it', async () => {
    const user = userEvent.setup();
    const props = renderViews({ section: makeSection({ items: [] }) });

    expect(screen.getByText('No items in this section')).toBeInTheDocument();
    expect(screen.queryByTestId('mobile-item-list')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Create item' }));
    expect(props.onCreateItem).toHaveBeenCalledTimes(1);
  });

  it('@smoke renders both the mobile list and the desktop table when items exist', () => {
    renderViews();

    const mobile = within(screen.getByTestId('mobile-item-list'));
    expect(mobile.getByText('Burrata')).toBeInTheDocument();
    expect(mobile.getByText('£9.50')).toBeInTheDocument();

    const desktop = within(screen.getByRole('table'));
    expect(desktop.getByText('Burrata')).toBeInTheDocument();
    expect(desktop.getByText('Item details')).toBeInTheDocument();
  });

  it('@contract @a11y mobile status switch toggles the item active flag', async () => {
    const user = userEvent.setup();
    const props = renderViews();

    const mobile = within(screen.getByTestId('mobile-item-list'));
    await user.click(mobile.getByRole('switch', { name: 'Set Burrata active' }));

    expect(props.onToggleItemActive).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'item-1' }),
      false,
    );
  });

  it('@smoke shows the description fallback when the item has none', () => {
    renderViews({
      section: makeSection({
        items: [makeItem({ labels: [{ displayName: 'Bare item', description: null, languageCode: 'en-GB' }] })],
      }),
    });

    const mobile = within(screen.getByTestId('mobile-item-list'));
    expect(mobile.getByText('No description yet')).toBeInTheDocument();
  });
});
