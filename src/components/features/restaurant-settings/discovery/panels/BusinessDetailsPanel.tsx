'use client';

import { FamilyActions, FamilyError, FamilyStatus } from '../DiscoveryPanelChrome';
import { BusinessDetailsForm } from './BusinessDetailsForm';
import { DiscoveryFamilyPanel } from './DiscoveryFamilyPanel';

import type { FamilyKey } from '../../businessContextModel';
import type { RestaurantBusinessContextEditor } from '../../useRestaurantBusinessContextEditor';

export function BusinessDetailsPanel({
  editor,
}: {
  embedded: boolean;
  editor: RestaurantBusinessContextEditor;
  family?: FamilyKey;
}) {
  return (
    <DiscoveryFamilyPanel>
      <FamilyStatus family="businessDetails" editor={editor} />

      <BusinessDetailsForm editor={editor} />

      <FamilyActions family="businessDetails" editor={editor} saveLabel="Save profile basics" />
      <FamilyError family="businessDetails" editor={editor} />
    </DiscoveryFamilyPanel>
  );
}
