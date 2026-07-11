import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { itemInitialState } from '@/components/features/menu/menuHierarchyDomain';
import { GuestMenuItemFields } from '@/components/features/menu/menuHierarchyGuestMenuItemFields';

import { applySetterCalls, switchByLabel } from './__fixtures__/menuHierarchy';

describe('GuestMenuItemFields', () => {
  it('@smoke renders guest availability controls with defaults', () => {
    render(<GuestMenuItemFields state={itemInitialState()} setState={vi.fn()} />);

    expect(screen.getByText('Guest menu')).toBeInTheDocument();
    expect(screen.getByText('Availability status')).toBeInTheDocument();
    expect(switchByLabel('Item active')).toBeChecked();
    expect(switchByLabel('Sold out')).not.toBeChecked();
    expect(switchByLabel('Orderable')).toBeChecked();
  });

  it('@contract patches service periods and availability note as the user types', async () => {
    const user = userEvent.setup();
    const setState = vi.fn();
    const initial = itemInitialState();
    render(<GuestMenuItemFields state={initial} setState={setState} />);

    await user.type(screen.getByPlaceholderText('lunch, dinner'), 'l');
    const textareas = screen.getAllByRole('textbox');
    await user.type(textareas[textareas.length - 1], 'n');

    const patched = applySetterCalls(setState, initial);
    expect(patched.servicePeriods).toBe('l');
    expect(patched.availabilityNote).toBe('n');
  });

  it('@contract toggling sold out patches only that flag', async () => {
    const user = userEvent.setup();
    const setState = vi.fn();
    const initial = itemInitialState();
    render(<GuestMenuItemFields state={initial} setState={setState} />);

    await user.click(switchByLabel('Sold out'));

    const patched = applySetterCalls(setState, initial);
    expect(patched.soldOut).toBe(true);
    expect(patched.active).toBe(true);
    expect(patched.orderable).toBe(true);
  });

  it('@contract selecting an availability status patches the state', async () => {
    const user = userEvent.setup();
    const setState = vi.fn();
    const initial = itemInitialState();
    render(<GuestMenuItemFields state={initial} setState={setState} />);

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'Seasonal' }));

    const patched = applySetterCalls(setState, initial);
    expect(patched.availabilityStatus).toBe('seasonal');
  });
});
