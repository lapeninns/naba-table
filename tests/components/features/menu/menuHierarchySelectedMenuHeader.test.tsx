import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SelectedMenuHeader } from '@/components/features/menu/menuHierarchySelectedMenuHeader';

import { makeItem, makeMenu, makeSection } from './__fixtures__/menuHierarchy';

function renderHeader(overrides: Partial<Parameters<typeof SelectedMenuHeader>[0]> = {}) {
  const selectedMenu = overrides.selectedMenu ?? makeMenu();
  const props = {
    catalogueMenus: [selectedMenu],
    onCreateMenu: vi.fn(),
    onCreateSection: vi.fn(),
    onDeleteMenu: vi.fn(),
    onEditMenu: vi.fn(),
    onSelectMenu: vi.fn(),
    selectedMenu,
    ...overrides,
  };
  render(<SelectedMenuHeader {...props} />);
  return props;
}

describe('SelectedMenuHeader', () => {
  it('@smoke shows the menu name, status badge, and section/item counts', () => {
    renderHeader({
      selectedMenu: makeMenu({
        sections: [makeSection({ items: [makeItem(), makeItem({ id: 'item-2' })] })],
      }),
    });

    expect(screen.getByRole('heading', { name: 'Dinner Menu' })).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('1 section')).toBeInTheDocument();
    expect(screen.getByText('2 items')).toBeInTheDocument();
    expect(screen.getByText('Seasonal food menu')).toBeInTheDocument();
  });

  it('@smoke marks inactive menus and pluralizes counts', () => {
    renderHeader({
      selectedMenu: makeMenu({
        active: false,
        sections: [makeSection({ items: [makeItem()] }), makeSection({ id: 'section-2', items: [] })],
      }),
    });

    expect(screen.getByText('Inactive')).toBeInTheDocument();
    expect(screen.getByText('2 sections')).toBeInTheDocument();
    expect(screen.getByText('1 item')).toBeInTheDocument();
  });

  it('@contract fires create, edit, and section callbacks from the toolbar', async () => {
    const user = userEvent.setup();
    const props = renderHeader();

    await user.click(screen.getByRole('button', { name: 'Menu' }));
    expect(props.onCreateMenu).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    expect(props.onEditMenu).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Section' }));
    expect(props.onCreateSection).toHaveBeenCalledTimes(1);
  });

  it('@contract @a11y deletes the menu through the labelled actions dropdown', async () => {
    const user = userEvent.setup();
    const props = renderHeader();

    await user.click(
      screen.getByRole('button', { name: 'Open menu actions for Dinner Menu' }),
    );
    await user.click(await screen.findByRole('menuitem', { name: 'Delete menu' }));

    expect(props.onDeleteMenu).toHaveBeenCalledTimes(1);
  });

  it('@contract only offers the menu switcher when multiple menus exist', async () => {
    const user = userEvent.setup();
    const selectedMenu = makeMenu();
    const drinks = makeMenu({
      id: 'menu-2',
      menuKind: 'drinks',
      labels: [{ displayName: 'Drinks Menu', description: null, languageCode: 'en-GB' }],
    });
    const props = renderHeader({
      selectedMenu,
      catalogueMenus: [selectedMenu, drinks],
    });

    const switcher = screen.getByRole('combobox', { name: 'Select menu' });
    await user.click(switcher);
    await user.click(await screen.findByRole('option', { name: 'Drinks Menu' }));

    expect(props.onSelectMenu).toHaveBeenCalledWith('menu-2');
  });

  it('@smoke hides the switcher for a single menu', () => {
    renderHeader();

    expect(screen.queryByRole('combobox', { name: 'Select menu' })).not.toBeInTheDocument();
  });
});
