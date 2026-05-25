'use client';

import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { type FamilyKey } from '../../businessContextModel';
import { FamilyActions, FamilyError, FamilyStatus } from '../DiscoveryPanelChrome';
import { CategoryRow } from './CategoryRow';
import { DiscoveryFamilyPanel } from './DiscoveryFamilyPanel';

import type { RestaurantBusinessContextEditor } from '../../useRestaurantBusinessContextEditor';

export function CategoriesPanel({
  editor,
}: {
  embedded: boolean;
  editor: RestaurantBusinessContextEditor;
  family?: FamilyKey;
}) {
  return (
    <DiscoveryFamilyPanel>
      <FamilyStatus family="categories" editor={editor} />

      {editor.categories.map((row) => (
        <CategoryRow key={row.id} row={row} editor={editor} />
      ))}

      <FamilyActions family="categories" editor={editor} saveLabel="Save categories">
        <Button type="button" variant="outline" onClick={editor.addCategory}>
          <Plus className="size-4" />
          Add category
        </Button>
      </FamilyActions>
      <FamilyError family="categories" editor={editor} />
    </DiscoveryFamilyPanel>
  );
}
