import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  ItemActions,
  ItemHealthBadge,
  ItemThumbnail,
  OptionRow,
  availabilityBadges,
} from '@/components/features/menu/menuHierarchyItemRows';

import { makeItem, makeOption } from './__fixtures__/menuHierarchy';

describe('availabilityBadges', () => {
  it('@contract maps availability policy states to badges', () => {
    expect(availabilityBadges(makeItem()).map((badge) => badge.label)).toEqual(['All services']);
    expect(
      availabilityBadges(
        makeItem({ extensions: { availabilityPolicy: { soldOut: true } } }),
      ).map((badge) => badge.label),
    ).toEqual(['Sold out']);
    expect(
      availabilityBadges(
        makeItem({ extensions: { availabilityPolicy: { orderable: false } } }),
      ).map((badge) => badge.label),
    ).toEqual(['Unavailable']);
    expect(
      availabilityBadges(
        makeItem({
          extensions: {
            availabilityPolicy: { servicePeriods: ['delivery', 'pickup', 'dine_in', 'brunch'] },
          },
        }),
      ).map((badge) => badge.label),
    ).toEqual(['Delivery', 'Pickup', 'Dine-in']);
  });
});

describe('ItemHealthBadge', () => {
  it('@contract shows Ready for a priced item with media', () => {
    render(<ItemHealthBadge item={makeItem()} />);

    expect(screen.getByText('Ready')).toBeInTheDocument();
  });

  it('@contract flags missing price and media as needing attention', () => {
    render(
      <ItemHealthBadge
        item={makeItem({
          attributes: { ...makeItem().attributes, price: null },
          media: { googleMediaKeys: [], localMedia: {} },
        })}
      />,
    );

    const badge = screen.getByText('Needs attention');
    expect(badge).toHaveAccessibleName('Status: Needs attention. Missing price. Missing media');
  });

  it('@contract labels inactive items', () => {
    render(<ItemHealthBadge item={makeItem({ active: false })} />);

    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });
});

describe('ItemThumbnail', () => {
  it('@smoke renders a decorative placeholder', () => {
    const { container } = render(<ItemThumbnail item={makeItem()} />);

    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
});

describe('ItemActions', () => {
  function renderActions(overrides: Partial<Parameters<typeof ItemActions>[0]> = {}) {
    const props = {
      item: makeItem(),
      itemIndex: 1,
      itemsCount: 3,
      patchPending: false,
      onQuickEditItem: vi.fn(),
      onEditItem: vi.fn(),
      onMoveItem: vi.fn().mockResolvedValue(undefined),
      onDeleteItem: vi.fn(),
      ...overrides,
    };
    render(<ItemActions {...props} />);
    return props;
  }

  it('@contract @a11y opens the labelled menu and fires quick edit, edit, and delete', async () => {
    const user = userEvent.setup();
    const props = renderActions();

    await user.click(screen.getByRole('button', { name: 'Open item actions for Burrata' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Quick edit' }));
    expect(props.onQuickEditItem).toHaveBeenCalledWith(props.item);

    await user.click(screen.getByRole('button', { name: 'Open item actions for Burrata' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Full edit' }));
    expect(props.onEditItem).toHaveBeenCalledWith(props.item);

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

    expect(screen.getByText('Inactive')).toBeInTheDocument();
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
