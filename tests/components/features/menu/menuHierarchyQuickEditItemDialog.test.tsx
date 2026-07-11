import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { QuickEditItemDialog } from '@/components/features/menu/menuHierarchyQuickEditItemDialog';

import { makeItem, switchByLabel } from './__fixtures__/menuHierarchy';

function renderDialog(overrides: Partial<Parameters<typeof QuickEditItemDialog>[0]> = {}) {
  const props = {
    gbpDriftField: null,
    item: makeItem(),
    open: true,
    pending: false,
    onOpenChange: vi.fn(),
    onSubmit: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  render(<QuickEditItemDialog {...props} />);
  return props;
}

describe('QuickEditItemDialog', () => {
  it('@smoke @a11y renders with values prefilled from the item', () => {
    renderDialog();

    expect(screen.getByRole('dialog', { name: 'Quick edit item' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('9.5')).toBeInTheDocument();
    expect(screen.getByDisplayValue('GBP')).toBeInTheDocument();
    expect(switchByLabel('Active')).toBeChecked();
    expect(switchByLabel('Sold out')).not.toBeChecked();
  });

  it('@contract submits a patch with edited price and sold-out flag', async () => {
    const user = userEvent.setup();
    const item = makeItem();
    const props = renderDialog({ item });

    const price = screen.getByDisplayValue('9.5');
    await user.clear(price);
    await user.type(price, '12.25');
    await user.click(switchByLabel('Sold out'));
    await user.click(screen.getByRole('button', { name: 'Save quick edit' }));

    await waitFor(() => expect(props.onSubmit).toHaveBeenCalledTimes(1));
    const [submittedItem, payload] = props.onSubmit.mock.calls[0];
    expect(submittedItem).toBe(item);
    expect(payload.attributes.price).toEqual({ currencyCode: 'GBP', amount: 12.25 });
    expect(payload.extensions.availabilityPolicy.soldOut).toBe(true);
    expect(payload.active).toBe(true);
  });

  it('@contract clearing the price submits a null amount', async () => {
    const user = userEvent.setup();
    const props = renderDialog();

    await user.clear(screen.getByDisplayValue('9.5'));
    await user.click(screen.getByRole('button', { name: 'Save quick edit' }));

    await waitFor(() => expect(props.onSubmit).toHaveBeenCalledTimes(1));
    expect(props.onSubmit.mock.calls[0][1].attributes.price.amount).toBeNull();
  });

  it('@contract picking an availability flag maps into the policy', async () => {
    const user = userEvent.setup();
    const props = renderDialog();

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'Unavailable' }));
    await user.click(screen.getByRole('button', { name: 'Save quick edit' }));

    await waitFor(() => expect(props.onSubmit).toHaveBeenCalledTimes(1));
    expect(props.onSubmit.mock.calls[0][1].extensions.availabilityPolicy.availabilityStatus).toBe(
      'unavailable',
    );
  });

  it('@contract disables saving while pending and closes on cancel', async () => {
    const user = userEvent.setup();
    const props = renderDialog({ pending: true });

    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });
});
