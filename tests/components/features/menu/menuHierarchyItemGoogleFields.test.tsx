import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { itemInitialState } from '@/components/features/menu/menuHierarchyDomain';
import {
  GoogleItemDetailsFields,
  ItemEssentialsFields,
} from '@/components/features/menu/menuHierarchyItemGoogleFields';

import { applySetterCalls, makeItem } from './__fixtures__/menuHierarchy';

describe('ItemEssentialsFields and GoogleItemDetailsFields', () => {
  it('@smoke essentials show name, description, price, dietary and allergens', () => {
    render(<ItemEssentialsFields state={itemInitialState()} setState={vi.fn()} />);

    expect(screen.getByText('Item name')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Price' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Dietary' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Allergens' })).toHaveAccessibleDescription(
      'Check with your kitchen before publishing',
    );
    expect(screen.queryByText('Preparation methods')).not.toBeInTheDocument();
  });

  it('@smoke Google details keep spiciness, serves, preparation, portion, nutrition and labels', () => {
    render(<GoogleItemDetailsFields state={itemInitialState()} setState={vi.fn()} />);

    for (const text of [
      'Spiciness',
      'Serves',
      'Preparation methods',
      'Ingredients',
      'Guest menu portion size',
      'Google nutrition facts',
      'Primary label language',
      'Additional Google labels',
    ]) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
  });

  it('@smoke prefills values from an existing item state', () => {
    const state = itemInitialState(makeItem());
    render(<ItemEssentialsFields state={state} setState={vi.fn()} />);

    expect(screen.getByDisplayValue('Burrata')).toBeInTheDocument();
    expect(screen.getByDisplayValue('9.5')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Creamy starter')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Dairy' })).toBeChecked();
  });

  it('@contract patches name, price, and description edits into state', async () => {
    const user = userEvent.setup();
    const setState = vi.fn();
    const initial = itemInitialState();
    render(<ItemEssentialsFields state={initial} setState={setState} />);

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
    render(<ItemEssentialsFields state={initial} setState={setState} />);

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
    render(<GoogleItemDetailsFields state={initial} setState={setState} />);

    await user.type(screen.getByPlaceholderText('Lower CALORIE'), '2');
    await user.type(screen.getByPlaceholderText('Upper CALORIE'), '5');

    const patched = applySetterCalls(setState, initial);
    expect(patched.calories).toBe('2');
    expect(patched.caloriesUpper).toBe('5');
  });
});
