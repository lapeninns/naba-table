import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  AvailabilityBadges,
  MenuItemOptions,
} from '@/components/features/menu/menuHierarchyItemTableShared';

import { makeItem, makeOption } from './__fixtures__/menuHierarchy';

function renderOptions(overrides: Partial<Parameters<typeof MenuItemOptions>[0]> = {}) {
  const props = {
    item: makeItem(),
    onCreateOption: vi.fn(),
    onDeleteOption: vi.fn().mockResolvedValue(undefined),
    onEditOption: vi.fn(),
    onMoveOption: vi.fn().mockResolvedValue(undefined),
    optionPatchPending: false,
    ...overrides,
  };
  render(<MenuItemOptions {...props} />);
  return props;
}

describe('MenuItemOptions', () => {
  it('@contract shows a single add-option affordance when the item has none', async () => {
    const user = userEvent.setup();
    const props = renderOptions();

    const addButton = screen.getByRole('button', { name: 'Add option' });
    await user.click(addButton);

    expect(props.onCreateOption).toHaveBeenCalledWith(props.item);
    expect(screen.queryByRole('button', { name: 'Option' })).not.toBeInTheDocument();
  });

  it('@contract lists option rows plus a compact add button when options exist', async () => {
    const user = userEvent.setup();
    const item = makeItem({
      options: [
        makeOption({ id: 'option-1', labels: [{ displayName: 'Small', description: null, languageCode: 'en-GB' }] }),
        makeOption({ id: 'option-2', labels: [{ displayName: 'Large', description: null, languageCode: 'en-GB' }] }),
      ],
    });
    const props = renderOptions({ item });

    expect(screen.getByText('Small')).toBeInTheDocument();
    expect(screen.getByText('Large')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Option' }));
    expect(props.onCreateOption).toHaveBeenCalledWith(item);
  });

  it('@contract wires option row edits through to the callbacks', async () => {
    const user = userEvent.setup();
    const option = makeOption({
      labels: [{ displayName: 'Small', description: null, languageCode: 'en-GB' }],
    });
    const item = makeItem({ options: [option] });
    const props = renderOptions({ item });

    await user.click(screen.getByRole('button', { name: 'Edit option Small' }));
    expect(props.onEditOption).toHaveBeenCalledWith(item, option);
  });
});

describe('AvailabilityBadges', () => {
  it('@smoke renders the derived badge set for the item', () => {
    render(<AvailabilityBadges item={makeItem()} />);

    expect(screen.getByText('All services')).toBeInTheDocument();
  });

  it('@smoke renders a sold-out badge from the policy', () => {
    render(
      <AvailabilityBadges
        item={makeItem({ extensions: { availabilityPolicy: { soldOut: true } } })}
      />,
    );

    expect(screen.getByText('Sold out')).toBeInTheDocument();
  });
});
