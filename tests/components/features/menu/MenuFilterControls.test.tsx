import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  MENU_STATUS_FILTER_OPTIONS,
  MenuFilterField,
} from '@/components/features/menu/MenuFilterControls';

describe('MenuFilterControls', () => {
  it('@contract exposes the full status filter option set', () => {
    expect(MENU_STATUS_FILTER_OPTIONS.map((option) => option.value)).toEqual([
      'all',
      'active',
      'inactive',
      'sold-out',
      'available',
      'unavailable',
    ]);
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
