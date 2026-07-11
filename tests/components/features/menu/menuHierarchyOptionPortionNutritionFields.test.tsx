import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { optionInitialState } from '@/components/features/menu/menuHierarchyDomain';
import { OptionPortionNutritionFields } from '@/components/features/menu/menuHierarchyOptionPortionNutritionFields';

import { applySetterCalls } from './__fixtures__/menuHierarchy';

describe('OptionPortionNutritionFields', () => {
  it('@smoke renders portion and nutrition groups', () => {
    render(<OptionPortionNutritionFields state={optionInitialState()} setState={vi.fn()} />);

    expect(screen.getByText('Option portion and nutrition')).toBeInTheDocument();
    expect(screen.getByText('Portion quantity')).toBeInTheDocument();
    expect(screen.getByText('Calories')).toBeInTheDocument();
    expect(screen.getByText('Protein')).toBeInTheDocument();
  });

  it('@contract patches portion quantity and unit label', async () => {
    const user = userEvent.setup();
    const setState = vi.fn();
    const initial = optionInitialState();
    render(<OptionPortionNutritionFields state={initial} setState={setState} />);

    await user.type(screen.getByPlaceholderText('1'), '2');
    await user.type(screen.getByPlaceholderText('pieces'), 'p');

    const patched = applySetterCalls(setState, initial);
    expect(patched.portionQuantity).toBe('2');
    expect(patched.portionUnitName).toBe('p');
  });

  it('@contract patches calorie range bounds', async () => {
    const user = userEvent.setup();
    const setState = vi.fn();
    const initial = optionInitialState();
    render(<OptionPortionNutritionFields state={initial} setState={setState} />);

    await user.type(screen.getByPlaceholderText('Lower CALORIE'), '1');
    await user.type(screen.getByPlaceholderText('Upper CALORIE'), '8');

    const patched = applySetterCalls(setState, initial);
    expect(patched.calories).toBe('1');
    expect(patched.caloriesUpper).toBe('8');
  });
});
