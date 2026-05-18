'use client';

import { ChevronDown, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { makeFieldId, type FamilyKey, type ServiceItemEditor } from '../../businessContextModel';
import { FamilyActions, FamilyError, FamilyStatus } from '../DiscoveryPanelChrome';
import { DiscoveryFamilyPanel } from './DiscoveryFamilyPanel';

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

function ServiceItemRow({
  row,
  editor,
}: {
  row: ServiceItemEditor;
  editor: RestaurantBusinessContextEditor;
}) {
  const fields: Array<[string, keyof ServiceItemEditor]> = [
    ['Service code', 'itemKey'],
    ['Service type', 'itemType'],
    ['Display name', 'displayName'],
    ['Description', 'description'],
  ];

  return (
    <div className="space-y-4 rounded-xl border border-border/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">
          {row.displayName || row.itemKey || 'New service item'}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.removeServiceItem(row.id)}
        >
          <Trash2 className="size-4" />
          Remove
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {fields.map(([label, field]) => (
          <div key={field} className="space-y-2">
            <Label htmlFor={makeFieldId('serviceItems', row.id, field)}>{label}</Label>
            <Input
              id={makeFieldId('serviceItems', row.id, field)}
              value={row[field] as string}
              onChange={(event) => editor.updateServiceItem(row.id, field, event.target.value)}
            />
          </div>
        ))}
      </div>
      <Collapsible className="rounded-lg border border-border/60 bg-muted/20 p-3">
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="group h-auto w-full items-start justify-between whitespace-normal px-0 py-0 text-left hover:bg-transparent"
          >
            <span className="flex min-w-0 flex-col gap-1">
              <span className="text-sm font-medium text-foreground">Advanced service data</span>
              <span className="text-xs font-normal text-muted-foreground">
                Keep this collapsed unless a provider sends extra service details.
              </span>
            </span>
            <ChevronDown className="ml-4 size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4">
          <div className="space-y-2">
            <Label htmlFor={makeFieldId('serviceItems', row.id, 'payloadJson')}>
              Service details
            </Label>
            <Textarea
              id={makeFieldId('serviceItems', row.id, 'payloadJson')}
              value={row.payloadJson}
              rows={5}
              onChange={(event) =>
                editor.updateServiceItem(row.id, 'payloadJson', event.target.value)
              }
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
