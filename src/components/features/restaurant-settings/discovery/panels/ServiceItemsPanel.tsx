'use client';

import { Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';

import { ServiceItemRow } from './ServiceItemRow';
import { makeFieldId } from '../../businessContextModel';
import { useDiscoveryForm } from '../DiscoveryFormContext';
import { DISCOVERY_FIELD_IDS } from '../discoveryValidation';

import type { RestaurantBusinessContextEditor } from '../../useRestaurantBusinessContextEditor';

type ServiceItemsPanelEditor = Pick<
  RestaurantBusinessContextEditor,
  'serviceItems' | 'addServiceItem' | 'updateServiceItem' | 'removeServiceItem'
>;

/** Section 5: services beyond the menu. */
export function ServiceItemsPanel({ editor }: { editor: ServiceItemsPanelEditor }) {
  const { requestFocus } = useDiscoveryForm();

  return (
    <>
      {editor.serviceItems.length > 0 ? (
        <div className="flex flex-col gap-2">
          {editor.serviceItems.map((row) => (
            <ServiceItemRow
              key={row.id}
              row={row}
              editor={editor}
              onRemove={() => {
                editor.removeServiceItem(row.id);
                requestFocus(DISCOVERY_FIELD_IDS.addService);
              }}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-1 rounded-lg border border-dashed border-border px-4 py-5 text-center">
          <p className="text-sm font-medium text-foreground">No services</p>
          <p className="text-xs text-muted-foreground">
            Add services like private dining or catering if you offer them.
          </p>
        </div>
      )}
      <div>
        <Button
          type="button"
          variant="outline"
          id={DISCOVERY_FIELD_IDS.addService}
          onClick={() =>
            requestFocus(makeFieldId('serviceItems', editor.addServiceItem(), 'displayName'))
          }
        >
          <Plus data-icon="inline-start" aria-hidden />
          Add service
        </Button>
      </div>
    </>
  );
}
