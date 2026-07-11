import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { itemInitialState } from '@/components/features/menu/menuHierarchyDomain';
import { GoogleItemEssentialsFields } from '@/components/features/menu/menuHierarchyItemGoogleFields';

import { applySetterCalls, makeItem } from './__fixtures__/menuHierarchy';

describe('GoogleItemEssentialsFields', () => {
  it('@smoke renders essentials, portion, and nutrition groups', () => {
    render(<GoogleItemEssentialsFields state={itemInitialState()} setState={vi.fn()} />);

    expect(screen.getByText('Essentials')).toBeInTheDocument();
    expect(screen.getByText('Item name')).toBeInTheDocument();
    expect(screen.getByText('Allergens')).toBeInTheDocument();
    expect(screen.getByText('Dietary restrictions')).toBeInTheDocument();
    expect(screen.getByText('Preparation methods')).toBeInTheDocument();
    expect(screen.getByText('Guest menu portion size')).toBeInTheDocument();
    expect(screen.getByText('Google nutrition facts')).toBeInTheDocument();
  });

  it('@smoke prefills values from an existing item state', () => {
    const state = itemInitialState(makeItem());
    render(<GoogleItemEssentialsFields state={state} setState={vi.fn()} />);

    expect(screen.getByDisplayValue('Burrata')).toBeInTheDocument();
    expect(screen.getByDisplayValue('9.5')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Creamy starter')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Dairy' })).toBeChecked();
  });

  it('@contract patches name, price, and description edits into state', async () => {
    const user = userEvent.setup();
    const setState = vi.fn();
    const initial = itemInitialState();
    render(<GoogleItemEssentialsFields state={initial} setState={setState} />);

    const [name] = screen.getAllByRole('textbox');
    await user.type(name, 'B');
    const [price] = screen.getAllByRole('spinbutton');
    await user.type(price, '7');

    const patched = applySetterCalls(setState, initial);
    expect(patched.displayName).toBe('B');
    expect(patched.price).toBe('7');
  });

  it('@contract toggles allergens on and off through the checkbox group', async () => {
    const user = userEvent.setup();
    const setState = vi.fn();
    const initial = { ...itemInitialState(), allergens: ['DAIRY'] };
    render(<GoogleItemEssentialsFields state={initial} setState={setState} />);

    await user.click(screen.getByRole('checkbox', { name: 'Egg' }));
    let patched = applySetterCalls(setState, initial);
    expect(patched.allergens).toContain('DAIRY');
    expect(patched.allergens).toContain('EGG');

    await user.click(screen.getByRole('checkbox', { name: 'Dairy' }));
    patched = applySetterCalls(setState, initial);
    expect(patched.allergens).not.toContain('DAIRY');
  });

  it('@contract patches nutrition lower and upper bounds', async () => {
    const user = userEvent.setup();
    const setState = vi.fn();
    const initial = itemInitialState();
    render(<GoogleItemEssentialsFields state={initial} setState={setState} />);

    await user.type(screen.getByPlaceholderText('Lower CALORIE'), '2');
    await user.type(screen.getByPlaceholderText('Upper CALORIE'), '5');

    const patched = applySetterCalls(setState, initial);
    expect(patched.calories).toBe('2');
    expect(patched.caloriesUpper).toBe('5');
  });
});
