'use client';

import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { type FamilyKey } from '../../businessContextModel';
import { FamilyActions, FamilyError, FamilyStatus } from '../DiscoveryPanelChrome';
import { DiscoveryFamilyPanel } from './DiscoveryFamilyPanel';
import { LinkRow } from './LinkRow';

import type { RestaurantBusinessContextEditor } from '../../useRestaurantBusinessContextEditor';

export function LinksPanel({
  editor,
}: {
  embedded: boolean;
  editor: RestaurantBusinessContextEditor;
  family?: FamilyKey;
}) {
  return (
    <DiscoveryFamilyPanel>
      <FamilyStatus family="links" editor={editor} />

      {editor.links.map((row) => (
        <LinkRow key={row.id} row={row} editor={editor} />
      ))}

      <FamilyActions family="links" editor={editor} saveLabel="Save links">
        <Button type="button" variant="outline" onClick={editor.addLink}>
          <Plus className="size-4" />
          Add link
        </Button>
      </FamilyActions>
      <FamilyError family="links" editor={editor} />
    </DiscoveryFamilyPanel>
  );
}
