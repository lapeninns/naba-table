import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { CategoriesPanel } from '@/components/features/restaurant-settings/discovery/panels/CategoriesPanel';

import { makeBusinessContextEditor, makeCategoryRow } from '../../testUtils';
import { renderWithDiscoveryForm } from '../renderWithDiscoveryForm';

import type { RestaurantBusinessContextEditor } from '@/components/features/restaurant-settings/useRestaurantBusinessContextEditor';

function renderPanel(over: Record<string, unknown> = {}) {
  const editor = makeBusinessContextEditor(over);
  renderWithDiscoveryForm(
    <CategoriesPanel editor={editor as unknown as RestaurantBusinessContextEditor} />,
  );
  return editor;
}

const categories = [
  makeCategoryRow({ id: 'category-a', displayName: 'Gastropub', isPrimary: true }),
  makeCategoryRow({ id: 'category-b', displayName: 'Wine bar', isPrimary: false }),
];

describe('CategoriesPanel', () => {
  it('@smoke shows categories as chips with the main one marked', () => {
    renderPanel({ categories });

    expect(screen.getByRole('list', { name: 'Categories' })).toHaveTextContent('Gastropub · main');
    // Only the other category offers Make main.
    expect(screen.getAllByRole('button', { name: /^Make main/ })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Make main: Wine bar' })).toBeInTheDocument();
  });

  it('@contract makes a category main, removes one and adds one by name', async () => {
    const user = userEvent.setup();
    const editor = renderPanel({ categories });

    await user.click(screen.getByRole('button', { name: 'Make main: Wine bar' }));
    expect(editor.makeCategoryPrimary).toHaveBeenCalledWith('category-b');

    await user.click(screen.getByRole('button', { name: 'Remove Gastropub' }));
    expect(editor.removeCategory).toHaveBeenCalledWith('category-a');
    await waitFor(() => expect(screen.getByLabelText('New category')).toHaveFocus());

    await user.type(screen.getByLabelText('New category'), 'Seafood restaurant{Enter}');
    expect(editor.addCategory).toHaveBeenCalledWith('Seafood restaurant');
    expect(screen.getByLabelText('New category')).toHaveValue('');
  });

  it('@contract offers Make main on every main category when more than one is main', () => {
    renderPanel({
      categories: categories.map((row) => ({ ...row, isPrimary: true })),
    });

    expect(screen.getAllByRole('button', { name: /^Make main/ })).toHaveLength(2);
  });

  it('@contract keeps codes and extra hours types under Advanced', async () => {
    const user = userEvent.setup();
    renderPanel({ categories });

    expect(screen.queryByLabelText('Category code')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Category codes and extra hours types/ }));
    expect(screen.getAllByLabelText('Category code')[0]).toHaveValue('gastropub');
  });

  it('@smoke shows an empty state', () => {
    renderPanel();

    expect(screen.getByText('No categories yet.')).toBeInTheDocument();
  });
});
