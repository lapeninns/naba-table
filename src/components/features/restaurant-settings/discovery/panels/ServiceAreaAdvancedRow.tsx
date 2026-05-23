'use client';

import { ChevronDown, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import {
  getServiceAreaAdvancedSubtitle,
  getServiceAreaChipLabel,
  SERVICE_AREA_MAIN_FIELDS,
  SERVICE_AREA_PROVIDER_FIELDS,
} from './serviceAreasPanelDomain';
import { makeFieldId, type ServiceAreaEditor } from '../../businessContextModel';

import type { RestaurantBusinessContextEditor } from '../../useRestaurantBusinessContextEditor';

export function ServiceAreaAdvancedRow({
  row,
  editor,
}: {
  row: ServiceAreaEditor;
  editor: RestaurantBusinessContextEditor;
}) {
  const label = getServiceAreaChipLabel(row);

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border/60 bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{getServiceAreaAdvancedSubtitle(row)}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Remove ${label}`}
          title="Remove service area"
          className="text-muted-foreground hover:text-destructive"
          onClick={() => editor.removeServiceArea(row.id)}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {SERVICE_AREA_MAIN_FIELDS.map(({ label: fieldLabel, field }) => (
          <div key={field} className="space-y-2">
            <Label htmlFor={makeFieldId('serviceAreas', row.id, field)}>{fieldLabel}</Label>
            <Input
              id={makeFieldId('serviceAreas', row.id, field)}
              value={row[field] as string}
              onChange={(event) => editor.updateServiceArea(row.id, field, event.target.value)}
            />
          </div>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {SERVICE_AREA_PROVIDER_FIELDS.slice(0, 1).map(({ label: fieldLabel, field }) => (
          <div key={field} className="space-y-2">
            <Label htmlFor={makeFieldId('serviceAreas', row.id, field)}>{fieldLabel}</Label>
            <Input
              id={makeFieldId('serviceAreas', row.id, field)}
              value={row[field] as string}
              onChange={(event) => editor.updateServiceArea(row.id, field, event.target.value)}
            />
          </div>
        ))}
      </div>
      <Collapsible
        defaultOpen={false}
        className="rounded-lg border border-border/60 bg-muted/20 p-3"
      >
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="group h-auto w-full items-start justify-between whitespace-normal px-0 py-0 text-left hover:bg-transparent"
          >
            <span className="flex min-w-0 flex-col gap-1">
              <span className="text-sm font-medium text-foreground">
                Show provider payload fields
              </span>
              <span className="text-xs font-normal text-muted-foreground">
                Edit raw place resource and structured place data from providers.
              </span>
            </span>
            <ChevronDown className="ml-4 size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4">
          <div className="grid gap-4 md:grid-cols-2">
            {SERVICE_AREA_PROVIDER_FIELDS.slice(1).map(({ label: fieldLabel, field }) => (
              <div key={field} className="space-y-2">
                <Label htmlFor={makeFieldId('serviceAreas', row.id, field)}>{fieldLabel}</Label>
                <Input
                  id={makeFieldId('serviceAreas', row.id, field)}
                  value={row[field] as string}
                  onChange={(event) => editor.updateServiceArea(row.id, field, event.target.value)}
                />
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <Label htmlFor={makeFieldId('serviceAreas', row.id, 'placeDataJson')}>Place data</Label>
            <Textarea
              id={makeFieldId('serviceAreas', row.id, 'placeDataJson')}
              value={row.placeDataJson}
              rows={4}
              onChange={(event) =>
                editor.updateServiceArea(row.id, 'placeDataJson', event.target.value)
              }
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
