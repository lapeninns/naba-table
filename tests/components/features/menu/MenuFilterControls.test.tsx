import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import {
  MENU_STATUS_FILTER_OPTIONS,
  MenuFilterField,
  MenuItemFilterToolbar,
} from '@/components/features/menu/MenuFilterControls';
import {
  DEFAULT_MENU_ITEM_FILTER,
  type MenuItemFilter,
} from '@/components/features/menu/menuHierarchyItemDomain';

function ToolbarHarness({ onChange }: { onChange?: (filter: MenuItemFilter) => void }) {
  const [filter, setFilter] = useState(DEFAULT_MENU_ITEM_FILTER);
  return (
    <MenuItemFilterToolbar
      filter={filter}
      onFilterChange={(next) => {
        setFilter(next);
        onChange?.(next);
      }}
    />
  );
}

describe('MenuFilterControls', () => {
  it('@contract exposes the All items / Needs attention / Sold out filter set', () => {
    expect(MENU_STATUS_FILTER_OPTIONS.map((option) => option.label)).toEqual([
      'All items',
      'Needs attention',
      'Sold out',
    ]);
    expect(MENU_STATUS_FILTER_OPTIONS.map((option) => option.value)).toEqual([
      'all',
      'attention',
      'sold-out',
    ]);
  });

  it('@contract @a11y toolbar labels the search and marks the pressed status filter', async () => {
    const user = userEvent.setup();
    const changes: MenuItemFilter[] = [];
    render(<ToolbarHarness onChange={(next) => changes.push(next)} />);

    const group = screen.getByRole('group', { name: 'Show' });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All items' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(screen.getByRole('button', { name: 'Needs attention' }));
    expect(screen.getByRole('button', { name: 'Needs attention' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'All items' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(changes.at(-1)).toEqual({ query: '', status: 'attention' });
  });

  it('@a11y search keeps focus and caret while the query updates', async () => {
    const user = userEvent.setup();
    const changes: MenuItemFilter[] = [];
    render(<ToolbarHarness onChange={(next) => changes.push(next)} />);

    const search = screen.getByRole('searchbox', { name: 'Search items' });
    await user.type(search, 'soup');

    expect(search).toHaveFocus();
    expect(search).toHaveValue('soup');
    expect((search as HTMLInputElement).selectionStart).toBe(4);
    expect(changes.at(-1)).toEqual({ query: 'soup', status: 'all' });
  });

  it('@contract @a11y associates the label with a single form control child', () => {
    render(
      <MenuFilterField label="Status filter">
        <input />
      </MenuFilterField>,
    );

    const input = screen.getByLabelText('Status filter');
    expect(input).toHaveAttribute('name', 'status-filter');
    expect(input).toHaveAttribute('id');
  });

  it('@contract keeps an explicit child id instead of generating one', () => {
    render(
      <MenuFilterField label="Search">
        <input id="custom-id" name="custom-name" />
      </MenuFilterField>,
    );

    const input = screen.getByLabelText('Search');
    expect(input).toHaveAttribute('id', 'custom-id');
    expect(input).toHaveAttribute('name', 'custom-name');
  });

  it('@a11y labels grouped div content via aria-labelledby without forcing an id', () => {
    render(
      <MenuFilterField label="Quick filters">
        <div role="group">
          <button type="button">Active</button>
        </div>
      </MenuFilterField>,
    );

    const group = screen.getByRole('group', { name: 'Quick filters' });
    expect(group).not.toHaveAttribute('id');
    expect(group).not.toHaveAttribute('name');
  });
});
