import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { optionInitialState } from '@/components/features/menu/menuHierarchyDomain';
import {
  OptionActiveField,
  OptionGoogleAttributeFields,
  OptionIdentityFields,
  OptionMediaFields,
  OptionParentSummary,
} from '@/components/features/menu/menuHierarchyOptionFields';

import { applySetterCalls, makeItem, makeOption, switchByLabel } from './__fixtures__/menuHierarchy';

describe('menuHierarchyOptionFields', () => {
  it('@smoke OptionParentSummary shows the parent item and its option count', () => {
    render(<OptionParentSummary item={makeItem({ options: [makeOption(), makeOption()] })} />);

    expect(screen.getByText('Burrata')).toBeInTheDocument();
    expect(screen.getByText('2 existing options')).toBeInTheDocument();
  });

  it('@contract OptionIdentityFields patches name, description, and price', async () => {
    const user = userEvent.setup();
    const setState = vi.fn();
    const initial = optionInitialState();
    render(<OptionIdentityFields state={initial} setState={setState} />);

    const [name] = screen.getAllByRole('textbox');
    await user.type(name, 'X');
    await user.type(screen.getByRole('spinbutton'), '4');

    const patched = applySetterCalls(setState, initial);
    expect(patched.displayName).toBe('X');
    expect(patched.price).toBe('4');
  });

  it('@smoke OptionIdentityFields prefills from an existing option', () => {
    const state = optionInitialState(makeOption());
    render(<OptionIdentityFields state={state} setState={vi.fn()} />);

    expect(screen.getByDisplayValue('Extra bread')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2')).toBeInTheDocument();
    expect(screen.getByDisplayValue('GBP')).toBeInTheDocument();
  });

  it('@contract OptionGoogleAttributeFields toggles allergens for the option', async () => {
    const user = userEvent.setup();
    const setState = vi.fn();
    const initial = optionInitialState();
    render(<OptionGoogleAttributeFields state={initial} setState={setState} />);

    expect(screen.getByText('Option Google attributes')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Fish' }));

    expect(applySetterCalls(setState, initial).allergens).toContain('FISH');
  });

  it('@contract OptionMediaFields patches media keys and local image URL', async () => {
    const user = userEvent.setup();
    const setState = vi.fn();
    const initial = optionInitialState();
    render(<OptionMediaFields state={initial} setState={setState} />);

    await user.type(screen.getByPlaceholderText('One Google media key per line'), 'k');
    const [, localUrl] = screen.getAllByRole('textbox');
    await user.type(localUrl, 'u');

    const patched = applySetterCalls(setState, initial);
    expect(patched.googleMediaKeys).toBe('k');
    expect(patched.localImageUrl).toBe('u');
  });

  it('@contract OptionActiveField toggles the active flag', async () => {
    const user = userEvent.setup();
    const setState = vi.fn();
    const initial = optionInitialState();
    render(<OptionActiveField state={initial} setState={setState} />);

    const control = switchByLabel('Option active');
    expect(control).toBeChecked();
    await user.click(control);

    expect(applySetterCalls(setState, initial).active).toBe(false);
  });
});
