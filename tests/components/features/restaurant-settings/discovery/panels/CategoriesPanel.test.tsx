import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { CategoriesPanel } from '@/components/features/restaurant-settings/discovery/panels/CategoriesPanel';

import { makeBusinessContextEditor, makeCategoryRow } from '../../testUtils';

import type { RestaurantBusinessContextEditor } from '@/components/features/restaurant-settings/useRestaurantBusinessContextEditor';

describe('CategoriesPanel', () => {
  it('@smoke renders a row per category with the add action', () => {
    const editor = makeBusinessContextEditor({
      categories: [makeCategoryRow(), makeCategoryRow({ id: 'category-2', displayName: 'Pub', isPrimary: false })],
    });
    render(
      <CategoriesPanel embedded={false} editor={editor as unknown as RestaurantBusinessContextEditor} />,
    );

    expect(screen.getByText('Gastropub')).toBeInTheDocument();
    expect(screen.getByText('Pub')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add category/ })).toBeInTheDocument();
  });

  it('@contract adds a category through the panel action', async () => {
    const user = userEvent.setup();
    const editor = makeBusinessContextEditor();
    render(
      <CategoriesPanel embedded={false} editor={editor as unknown as RestaurantBusinessContextEditor} />,
    );

    await user.click(screen.getByRole('button', { name: /Add category/ }));

    expect(editor.addCategory).toHaveBeenCalledTimes(1);
  });
});
