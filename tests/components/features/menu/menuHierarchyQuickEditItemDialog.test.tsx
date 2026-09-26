import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { NONE_VALUE } from '@/components/features/menu/menuHierarchyDomain';
import {
  QuickEditItemDialog,
  buildQuickEditPatch,
} from '@/components/features/menu/menuHierarchyQuickEditItemDialog';

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
    expect(switchByLabel('Shown on the menu')).toBeChecked();
    expect(switchByLabel('Sold out')).not.toBeChecked();
  });

  it('@contract submits only the changed fields as merge patches', async () => {
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
    // No whole attributes/extensions snapshot: concurrent edits to other fields survive.
    expect(payload).toEqual({
      attributesMerge: { price: { currencyCode: 'GBP', amount: 12.25 } },
      extensionsMerge: { availabilityPolicy: { soldOut: true } },
    });
  });

  it('@contract clearing the price submits a null amount', async () => {
    const user = userEvent.setup();
    const props = renderDialog();

    await user.clear(screen.getByDisplayValue('9.5'));
    await user.click(screen.getByRole('button', { name: 'Save quick edit' }));

    await waitFor(() => expect(props.onSubmit).toHaveBeenCalledTimes(1));
    expect(props.onSubmit.mock.calls[0][1]).toEqual({
      attributesMerge: { price: { currencyCode: 'GBP', amount: null } },
    });
  });

  it('@contract picking an availability flag maps into the policy', async () => {
    const user = userEvent.setup();
    const props = renderDialog();

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'Unavailable' }));
    await user.click(screen.getByRole('button', { name: 'Save quick edit' }));

    await waitFor(() => expect(props.onSubmit).toHaveBeenCalledTimes(1));
    expect(props.onSubmit.mock.calls[0][1]).toEqual({
      extensionsMerge: { availabilityPolicy: { availabilityStatus: 'unavailable' } },
    });
  });

  it('@contract saving with no changes closes without a request', async () => {
    const user = userEvent.setup();
    const props = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Save quick edit' }));

    expect(props.onSubmit).not.toHaveBeenCalled();
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('@contract buildQuickEditPatch sends visibility alone when only that changed', () => {
    const item = makeItem({ active: true });

    expect(
      buildQuickEditPatch(item, {
        price: '9.5',
        currencyCode: 'gbp',
        active: false,
        soldOut: false,
        availabilityStatus: NONE_VALUE,
      }),
    ).toEqual({ active: false });
  });

  it('@contract disables saving while pending and closes on cancel', async () => {
    const user = userEvent.setup();
    const props = renderDialog({ pending: true });

    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });
});
