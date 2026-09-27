import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  SelectedMenuCard,
  menuSummaryLine,
} from '@/components/features/menu/menuHierarchySelectedMenuHeader';

import { makeItem, makeMenu, makeSection } from './__fixtures__/menuHierarchy';

function renderHeader(overrides: Partial<Parameters<typeof SelectedMenuCard>[0]> = {}) {
  const props = {
    onCreateSection: vi.fn(),
    onDeleteMenu: vi.fn(),
    onEditMenu: vi.fn(),
    selectedMenu: makeMenu(),
    ...overrides,
  };
  render(
    <SelectedMenuCard {...props} subheader={<p>Filter strip</p>}>
      <p>Sections</p>
    </SelectedMenuCard>,
  );
  return props;
}

describe('SelectedMenuCard', () => {
  it('@smoke shows the menu name, Shown to guests badge and counts', () => {
    renderHeader({
      selectedMenu: makeMenu({
        sections: [makeSection({ items: [makeItem(), makeItem({ id: 'item-2' })] })],
      }),
    });

    const heading = screen.getByRole('heading', { level: 2, name: 'Dinner Menu' });
    expect(heading).toBeInTheDocument();
    // The menu is one settings card, exposed as a region named by its title.
    const card = screen.getByRole('region', { name: 'Dinner Menu' });
    expect(card).toHaveAttribute('data-slot', 'settings-card');
    expect(card).toHaveAttribute('data-testid', 'menu-card');
    expect(card).toHaveTextContent('Filter strip');
    expect(card).toHaveTextContent('Sections');
    expect(screen.getByText('Shown to guests')).toBeInTheDocument();
    expect(screen.getByText('1 section · 2 items')).toBeInTheDocument();
    expect(screen.getByText('Seasonal food menu')).toBeInTheDocument();
  });

  it('@smoke marks hidden menus and counts items that need attention', () => {
    renderHeader({
      selectedMenu: makeMenu({
        active: false,
        sections: [
          makeSection({
            items: [
              makeItem(),
              makeItem({ id: 'item-2', media: { googleMediaKeys: [], localMedia: {} } }),
            ],
          }),
          makeSection({ id: 'section-2', items: [] }),
        ],
      }),
    });

    // A status Badge (status-completed), not a hand-rolled outline pill.
    expect(screen.getByText('Hidden')).toHaveClass('bg-secondary');
    expect(screen.getByText('2 sections · 2 items · 1 need attention')).toBeInTheDocument();
  });

  it('@contract summary line omits the attention count when nothing needs attention', () => {
    expect(menuSummaryLine(makeMenu({ sections: [] }))).toBe('0 sections · 0 items');
  });

  it('@contract fires Menu settings and Add section callbacks', async () => {
    const user = userEvent.setup();
    const props = renderHeader();

    await user.click(screen.getByRole('button', { name: 'Menu settings' }));
    expect(props.onEditMenu).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Add section' }));
    expect(props.onCreateSection).toHaveBeenCalledTimes(1);
  });

  it('@contract @a11y deletes the menu through the labelled actions dropdown', async () => {
    const user = userEvent.setup();
    const props = renderHeader();

    await user.click(screen.getByRole('button', { name: 'Open menu actions for Dinner Menu' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete menu' }));

    expect(props.onDeleteMenu).toHaveBeenCalledTimes(1);
  });
});
