import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MenuSectionList } from '@/components/features/menu/menuHierarchySections';

import {
  makeItem,
  makeMenu,
  makeSection,
  mutationStub,
  type MutationStub,
} from './__fixtures__/menuHierarchy';

const hooks = vi.hoisted(() => ({
  reorder: undefined as unknown as MutationStub,
  patchItem: undefined as unknown as MutationStub,
}));

const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock('sonner', () => ({ toast: toastMock }));

vi.mock('@/hooks/ops/useOpsMenuHierarchy', () => ({
  useOpsReorderMenuChildren: () => hooks.reorder,
  useOpsUpdateRestaurantMenuItem: () => hooks.patchItem,
}));

const twoSectionMenu = () =>
  makeMenu({
    sections: [
      makeSection({
        id: 'section-1',
        displayOrder: 1,
        items: [
          makeItem({ id: 'item-1' }),
          makeItem({
            id: 'item-2',
            labels: [{ displayName: 'Soup', description: 'Of the day', languageCode: 'en-GB' }],
            extensions: { availabilityPolicy: { soldOut: true } },
          }),
        ],
      }),
      makeSection({
        id: 'section-2',
        displayOrder: 2,
        labels: [{ displayName: 'Mains', description: null, languageCode: 'en-GB' }],
        items: [],
        active: false,
      }),
    ],
  });

function renderSections(overrides: Partial<Parameters<typeof MenuSectionList>[0]> = {}) {
  const props = {
    menu: twoSectionMenu(),
    gbpDriftFields: [],
    restaurantId: 'rest-1',
    onCreateSection: vi.fn(),
    onCreateItem: vi.fn(),
    onEditSection: vi.fn(),
    onDeleteSection: vi.fn(),
    onEditItem: vi.fn(),
    onDeleteItem: vi.fn(),
    onCreateOption: vi.fn(),
    ...overrides,
  };
  render(<MenuSectionList {...props} />);
  return props;
}

describe('MenuSectionList', () => {
  beforeEach(() => {
    hooks.reorder = mutationStub();
    hooks.patchItem = mutationStub();
    toastMock.success.mockReset();
    toastMock.error.mockReset();
  });

  it('@smoke offers Add section when the menu has no sections', async () => {
    const user = userEvent.setup();
    const props = renderSections({ menu: makeMenu({ sections: [] }) });

    expect(screen.getByText('No sections yet')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add section' }));
    expect(props.onCreateSection).toHaveBeenCalledTimes(1);
  });

  it('@smoke renders every section open with its heading, item count and hidden badge', () => {
    renderSections();

    const starters = screen.getByRole('region', { name: /Starters/ });
    expect(within(starters).getByRole('heading', { level: 3 })).toHaveTextContent('Starters');
    expect(within(starters).getByText('2 items')).toBeInTheDocument();
    expect(within(starters).getByText('Burrata')).toBeInTheDocument();

    const mains = screen.getByRole('region', { name: /Mains/ });
    expect(within(mains).getByText('0 items')).toBeInTheDocument();
    expect(within(mains).getByText('Hidden')).toBeInTheDocument();
    expect(within(mains).getByText('No items in this section yet.')).toBeInTheDocument();
  });

  it('@contract moving a section down sends one reorder command for the menu', async () => {
    const user = userEvent.setup();
    renderSections();

    await user.click(screen.getByRole('button', { name: 'Move Starters down' }));

    expect(hooks.reorder.mutate).toHaveBeenCalledTimes(1);
    expect(hooks.reorder.mutate).toHaveBeenCalledWith({
      target: { level: 'sections', menuId: 'menu-1' },
      orderedIds: ['section-2', 'section-1'],
    });
    // Failure feedback comes from the hook's meta (global toast), with rollback in the cache.
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it('@contract disables every move while a reorder is saving', () => {
    hooks.reorder = mutationStub({ isPending: true });
    renderSections();

    expect(screen.getByRole('button', { name: 'Move Starters down' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move Mains up' })).toBeDisabled();
  });

  it('@contract disables move-up on the first and move-down on the last section', () => {
    renderSections();

    expect(screen.getByRole('button', { name: 'Move Starters up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move Mains down' })).toBeDisabled();
  });

  it('@contract @a11y edits a section from its header and deletes it from its actions menu', async () => {
    const user = userEvent.setup();
    const props = renderSections();

    await user.click(screen.getByRole('button', { name: 'Edit Starters' }));
    expect(props.onEditSection).toHaveBeenCalledWith(expect.objectContaining({ id: 'section-1' }));

    await user.click(screen.getByRole('button', { name: 'Open section actions for Starters' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete section' }));
    expect(props.onDeleteSection).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'section-1' }),
    );
  });

  it('@contract adds an item scoped to its section', async () => {
    const user = userEvent.setup();
    const props = renderSections();

    await user.click(screen.getByRole('button', { name: 'Add item to Mains' }));

    expect(props.onCreateItem).toHaveBeenCalledWith(expect.objectContaining({ id: 'section-2' }));
  });

  it('@contract search hides non-matching items and empty sections', () => {
    renderSections({ filter: { query: 'soup', status: 'all' } });

    expect(screen.getByText('Soup')).toBeInTheDocument();
    expect(screen.queryByText('Burrata')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /Mains/ })).not.toBeInTheDocument();
  });

  it('@contract the Sold out filter keeps only sold-out items', () => {
    renderSections({ filter: { query: '', status: 'sold-out' } });

    expect(screen.getByText('Soup')).toBeInTheDocument();
    expect(screen.queryByText('Burrata')).not.toBeInTheDocument();
  });

  it('@contract shows No items match when the filter matches nothing', () => {
    renderSections({ filter: { query: 'zzz', status: 'all' } });

    expect(screen.getByText('No items match')).toBeInTheDocument();
    expect(screen.getByText('Try another search or filter.')).toBeInTheDocument();
  });
});
