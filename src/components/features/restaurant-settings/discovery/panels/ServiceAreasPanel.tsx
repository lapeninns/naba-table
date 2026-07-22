'use client';

import { ChevronDown, Plus, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/typography';

import { type FamilyKey } from '../../businessContextModel';
import { FamilyActions, FamilyError, FamilyStatus } from '../DiscoveryPanelChrome';
import { DiscoveryFamilyPanel } from './DiscoveryFamilyPanel';
import { ServiceAreaAdvancedRow } from './ServiceAreaAdvancedRow';
import { getServiceAreaChipLabel } from './serviceAreasPanelDomain';

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
          <Text variant="label">Service areas</Text>
          <Text variant="caption" className="leading-5">
            Add the places or regions guests can reasonably associate with this restaurant.
          </Text>
        </div>

        {editor.serviceAreas.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {editor.serviceAreas.map((row) => {
              const label = getServiceAreaChipLabel(row);
              return (
                <Badge
                  key={row.id}
                  variant="secondary"
                  className="gap-1.5 rounded-md py-1 pl-2 pr-1"
                >
                  <span>{label}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${label}`}
                    className="size-5 rounded-sm text-muted-foreground hover:bg-background hover:text-foreground"
                    onClick={() => editor.removeServiceArea(row.id)}
                  >
                    <X className="size-3" />
                  </Button>
                </Badge>
              );
            })}
          </div>
        ) : (
          <Text variant="caption">No service areas have been added.</Text>
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
