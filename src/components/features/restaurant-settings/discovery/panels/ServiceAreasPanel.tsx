'use client';

import { ChevronDown, Plus, Trash2, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import {
  formatServiceAreaTitle,
  makeFieldId,
  type FamilyKey,
  type ServiceAreaEditor,
} from '../../businessContextModel';
import { FamilyActions, FamilyError, FamilyStatus } from '../DiscoveryPanelChrome';
import { DiscoveryFamilyPanel } from './DiscoveryFamilyPanel';

import type { RestaurantBusinessContextEditor } from '../../useRestaurantBusinessContextEditor';
import type { KeyboardEvent } from 'react';

export function ServiceAreasPanel({
  editor,
}: {
  embedded: boolean;
  editor: RestaurantBusinessContextEditor;
  family?: FamilyKey;
}) {
  return (
    <DiscoveryFamilyPanel>
      <FamilyStatus family="serviceAreas" editor={editor} />

      <div className="flex flex-col gap-4 rounded-lg border border-border/60 p-4">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-foreground">Service areas</p>
          <p className="text-xs leading-5 text-muted-foreground">
            Add the places or regions guests can reasonably associate with this restaurant.
          </p>
        </div>

        {editor.serviceAreas.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {editor.serviceAreas.map((row) => (
              <Badge key={row.id} variant="secondary" className="gap-1.5 rounded-md py-1 pl-2 pr-1">
                <span>{formatServiceAreaTitle(row)}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${formatServiceAreaTitle(row)}`}
                  className="size-5 rounded-sm text-muted-foreground hover:bg-background hover:text-foreground"
                  onClick={() => editor.removeServiceArea(row.id)}
                >
                  <X className="size-3" />
                </Button>
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No service areas have been added.</p>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={editor.serviceAreaDraft}
            placeholder="Add an area, e.g. Cambridge, UK"
            aria-label="New service area"
            onChange={(event) => editor.setServiceAreaDraft(event.target.value)}
            onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                editor.addServiceAreaFromDraft();
              }
            }}
          />
          <Button type="button" variant="outline" onClick={editor.addServiceAreaFromDraft}>
            <Plus className="size-4" />
            Add area
          </Button>
        </div>
      </div>

      {editor.serviceAreas.length > 0 ? (
        <Collapsible className="rounded-lg border border-border/60 bg-muted/20 p-3">
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="group h-auto w-full items-start justify-between whitespace-normal px-0 py-0 text-left hover:bg-transparent"
            >
              <span className="flex min-w-0 flex-col gap-1">
                <span className="text-sm font-medium text-foreground">
                  Advanced service-area details
                </span>
                <span className="text-xs font-normal text-muted-foreground">
                  Edit provider IDs and structured place data only when needed.
                </span>
              </span>
              <ChevronDown className="ml-4 size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4">
            <div className="flex flex-col gap-4">
              {editor.serviceAreas.map((row) => (
                <ServiceAreaAdvancedRow key={row.id} row={row} editor={editor} />
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      ) : null}

      <FamilyActions family="serviceAreas" editor={editor} saveLabel="Save service areas" />
      <FamilyError family="serviceAreas" editor={editor} />
    </DiscoveryFamilyPanel>
  );
}

function ServiceAreaAdvancedRow({
  row,
  editor,
}: {
  row: ServiceAreaEditor;
  editor: RestaurantBusinessContextEditor;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border/60 bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {formatServiceAreaTitle(row)}
          </p>
          <p className="text-xs text-muted-foreground">
            {row.areaType || 'region'}
            {row.regionCode ? ` · ${row.regionCode}` : ''}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Remove ${formatServiceAreaTitle(row)}`}
          title="Remove service area"
          className="text-muted-foreground hover:text-destructive"
          onClick={() => editor.removeServiceArea(row.id)}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor={makeFieldId('serviceAreas', row.id, 'displayName')}>Area name</Label>
          <Input
            id={makeFieldId('serviceAreas', row.id, 'displayName')}
            value={row.displayName}
            onChange={(event) =>
              editor.updateServiceArea(row.id, 'displayName', event.target.value)
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={makeFieldId('serviceAreas', row.id, 'areaType')}>Area type</Label>
          <Input
            id={makeFieldId('serviceAreas', row.id, 'areaType')}
            value={row.areaType}
            onChange={(event) => editor.updateServiceArea(row.id, 'areaType', event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={makeFieldId('serviceAreas', row.id, 'regionCode')}>
            Country or region
          </Label>
          <Input
            id={makeFieldId('serviceAreas', row.id, 'regionCode')}
            value={row.regionCode}
            onChange={(event) => editor.updateServiceArea(row.id, 'regionCode', event.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={makeFieldId('serviceAreas', row.id, 'googlePlaceId')}>
            Google place ID
          </Label>
          <Input
            id={makeFieldId('serviceAreas', row.id, 'googlePlaceId')}
            value={row.googlePlaceId}
            onChange={(event) =>
              editor.updateServiceArea(row.id, 'googlePlaceId', event.target.value)
            }
          />
        </div>
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
            <div className="space-y-2">
              <Label htmlFor={makeFieldId('serviceAreas', row.id, 'googlePlaceResourceName')}>
                Place resource
              </Label>
              <Input
                id={makeFieldId('serviceAreas', row.id, 'googlePlaceResourceName')}
                value={row.googlePlaceResourceName}
                onChange={(event) =>
                  editor.updateServiceArea(row.id, 'googlePlaceResourceName', event.target.value)
                }
              />
            </div>
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
