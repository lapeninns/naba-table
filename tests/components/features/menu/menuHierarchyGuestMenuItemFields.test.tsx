import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { itemInitialState } from '@/components/features/menu/menuHierarchyDomain';
import {
  ItemAvailabilityDetailsFields,
  ItemAvailabilityFields,
} from '@/components/features/menu/menuHierarchyGuestMenuItemFields';

import { applySetterCalls, switchByLabel } from './__fixtures__/menuHierarchy';

describe('ItemAvailabilityFields', () => {
  it('@smoke @a11y groups shown, sold out and served at under Availability', () => {
    render(<ItemAvailabilityFields state={itemInitialState()} setState={vi.fn()} />);

    expect(screen.getByRole('group', { name: 'Availability' })).toBeInTheDocument();
    expect(switchByLabel('Shown on the menu')).toBeChecked();
    expect(switchByLabel('Sold out for now')).not.toBeChecked();
    expect(screen.getByRole('textbox', { name: 'Served at' })).toHaveAccessibleDescription(
      'Leave empty to serve it at all services. Separate services with commas.',
    );
  });

  it('@contract toggling sold out patches only that flag', async () => {
    const user = userEvent.setup();
    const setState = vi.fn();
    const initial = itemInitialState();
    render(<ItemAvailabilityFields state={initial} setState={setState} />);

    await user.click(switchByLabel('Sold out for now'));

    const patched = applySetterCalls(setState, initial);
    expect(patched.soldOut).toBe(true);
    expect(patched.active).toBe(true);
    expect(patched.orderable).toBe(true);
  });

  it('@contract patches the service periods as the user types', async () => {
    const user = userEvent.setup();
    const setState = vi.fn();
    const initial = itemInitialState();
    render(<ItemAvailabilityFields state={initial} setState={setState} />);

    await user.type(screen.getByPlaceholderText('lunch, dinner'), 'l');

    expect(applySetterCalls(setState, initial).servicePeriods).toBe('l');
  });
});

describe('ItemAvailabilityDetailsFields', () => {
  it('@smoke keeps status, orderable and the policy note', () => {
    render(<ItemAvailabilityDetailsFields state={itemInitialState()} setState={vi.fn()} />);

    expect(screen.getByText('Availability status')).toBeInTheDocument();
    expect(switchByLabel('Orderable')).toBeChecked();
    expect(screen.getByText('Availability policy note')).toBeInTheDocument();
  });

  it('@contract selecting an availability status and typing a note patch the state', async () => {
    const user = userEvent.setup();
    const setState = vi.fn();
    const initial = itemInitialState();
    render(<ItemAvailabilityDetailsFields state={initial} setState={setState} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'Seasonal' }));
    await user.type(screen.getByRole('textbox'), 'n');

    const patched = applySetterCalls(setState, initial);
    expect(patched.availabilityStatus).toBe('seasonal');
    expect(patched.availabilityNote).toBe('n');
  });
});
