'use client';

import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { type FamilyKey } from '../../businessContextModel';
import { FamilyActions, FamilyError, FamilyStatus } from '../DiscoveryPanelChrome';
import { DiscoveryFamilyPanel } from './DiscoveryFamilyPanel';
import { ServiceItemRow } from './ServiceItemRow';

import type { RestaurantBusinessContextEditor } from '../../useRestaurantBusinessContextEditor';

export function ServiceItemsPanel({
  editor,
}: {
  embedded: boolean;
  editor: RestaurantBusinessContextEditor;
  family?: FamilyKey;
}) {
  return (
    <DiscoveryFamilyPanel>
      <FamilyStatus family="serviceItems" editor={editor} />

      {editor.serviceItems.map((row) => (
        <ServiceItemRow key={row.id} row={row} editor={editor} />
      ))}

      <FamilyActions family="serviceItems" editor={editor} saveLabel="Save service items">
        <Button type="button" variant="outline" onClick={editor.addServiceItem}>
          <Plus className="size-4" />
          Add service item
        </Button>
      </FamilyActions>
      <FamilyError family="serviceItems" editor={editor} />
    </DiscoveryFamilyPanel>
  );
}
