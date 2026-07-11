import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SectionAccordionTable } from '@/components/features/menu/menuHierarchySections';

import {
  makeItem,
  makeMenu,
  makeSection,
  mutationStub,
  type MutationStub,
} from './__fixtures__/menuHierarchy';

const hooks = vi.hoisted(() => ({
  patchSection: undefined as unknown as MutationStub,
  patchItem: undefined as unknown as MutationStub,
  patchOption: undefined as unknown as MutationStub,
}));

vi.mock('@/hooks/ops/useOpsMenuHierarchy', () => ({
  useOpsPatchRestaurantMenuSection: () => hooks.patchSection,
  useOpsPatchRestaurantMenuItem: () => hooks.patchItem,
  useOpsPatchRestaurantMenuOption: () => hooks.patchOption,
}));

const twoSectionMenu = () =>
  makeMenu({
    sections: [
      makeSection({ id: 'section-1', displayOrder: 1 }),
      makeSection({
        id: 'section-2',
        displayOrder: 2,
        labels: [{ displayName: 'Mains', description: null, languageCode: 'en-GB' }],
        items: [],
        active: false,
      }),
    ],
  });

function renderSections(overrides: Partial<Parameters<typeof SectionAccordionTable>[0]> = {}) {
  const props = {
    menu: twoSectionMenu(),
    gbpDriftFields: [],
    selectedSectionId: 'section-1',
    restaurantId: 'rest-1',
    onSelectSection: vi.fn(),
    onCreateItem: vi.fn(),
    onEditSection: vi.fn(),
    onDeleteSection: vi.fn(),
    onEditItem: vi.fn(),
    onDeleteItem: vi.fn(),
    onCreateOption: vi.fn(),
    onEditOption: vi.fn(),
    onDeleteOption: vi.fn(),
    ...overrides,
  };
  render(<SectionAccordionTable {...props} />);
  return props;
}

describe('SectionAccordionTable', () => {
  beforeEach(() => {
    hooks.patchSection = mutationStub();
    hooks.patchItem = mutationStub();
    hooks.patchOption = mutationStub();
  });

  it('@smoke shows an empty state when the menu has no sections', () => {
    renderSections({ menu: makeMenu({ sections: [] }) });

    expect(screen.getByText('No sections yet')).toBeInTheDocument();
  });

  it('@smoke renders section titles, item counts, and inactive badges', () => {
    renderSections();

    expect(screen.getByText('Starters')).toBeInTheDocument();
    expect(screen.getByText('Mains')).toBeInTheDocument();
    expect(screen.getByText('1 item')).toBeInTheDocument();
    expect(screen.getByText('0 items')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('@contract expands the selected section to reveal its item table', () => {
    renderSections();

    expect(within(screen.getByRole('table')).getByText('Burrata')).toBeInTheDocument();
  });

  it('@contract selecting a collapsed section reports its id', async () => {
    const user = userEvent.setup();
    const props = renderSections();

    await user.click(screen.getByRole('button', { name: /^Mains/ }));

    expect(props.onSelectSection).toHaveBeenCalledWith('section-2');
  });

  it('@contract moving a section down swaps display orders via two patches', async () => {
    const user = userEvent.setup();
    renderSections();

    const [moveFirstDown] = screen.getAllByRole('button', { name: 'Move section down' });
    await user.click(moveFirstDown);

    await waitFor(() => expect(hooks.patchSection.mutateAsync).toHaveBeenCalledTimes(2));
    expect(hooks.patchSection.mutateAsync).toHaveBeenCalledWith({
      menuId: 'menu-1',
      sectionId: 'section-1',
      payload: { displayOrder: 2 },
    });
    expect(hooks.patchSection.mutateAsync).toHaveBeenCalledWith({
      menuId: 'menu-1',
      sectionId: 'section-2',
      payload: { displayOrder: 1 },
    });
  });

  it('@contract disables move-up on the first and move-down on the last section', () => {
    renderSections();

    const ups = screen.getAllByRole('button', { name: 'Move section up' });
    const downs = screen.getAllByRole('button', { name: 'Move section down' });
    expect(ups[0]).toBeDisabled();
    expect(downs[downs.length - 1]).toBeDisabled();
  });

  it('@contract @a11y edits and deletes a section through its actions menu', async () => {
    const user = userEvent.setup();
    const props = renderSections();

    await user.click(screen.getByRole('button', { name: 'Open section actions for Starters' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Edit section' }));
    expect(props.onEditSection).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'section-1' }),
    );

    await user.click(screen.getByRole('button', { name: 'Open section actions for Starters' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete section' }));
    expect(props.onDeleteSection).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'section-1' }),
    );
  });

  it('@contract adds an item scoped to its section', async () => {
    const user = userEvent.setup();
    const props = renderSections();

    const [addToFirst] = screen.getAllByRole('button', { name: 'Add item' });
    await user.click(addToFirst);

    expect(props.onCreateItem).toHaveBeenCalledWith(expect.objectContaining({ id: 'section-1' }));
  });

  it('@contract renders items of items-bearing sections through ItemTable', () => {
    renderSections();

    const mobileLists = screen.getAllByTestId('mobile-item-list');
    expect(within(mobileLists[0]).getByText('Burrata')).toBeInTheDocument();
  });
});
