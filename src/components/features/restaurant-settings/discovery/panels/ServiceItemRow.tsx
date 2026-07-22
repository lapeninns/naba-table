'use client';

import { ChevronDown, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Text } from '@/components/ui/typography';

import { getServiceItemRowTitle, SERVICE_ITEM_MAIN_FIELDS } from './serviceItemsPanelDomain';
import { makeFieldId, type ServiceItemEditor } from '../../businessContextModel';

import type { RestaurantBusinessContextEditor } from '../../useRestaurantBusinessContextEditor';

export function ServiceItemRow({
  row,
  editor,
}: {
  row: ServiceItemEditor;
  editor: RestaurantBusinessContextEditor;
}) {
  return (
    <div className="space-y-4 rounded-xl border border-border/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <Text variant="label">{getServiceItemRowTitle(row)}</Text>
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
        {SERVICE_ITEM_MAIN_FIELDS.map(({ label, field }) => (
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
