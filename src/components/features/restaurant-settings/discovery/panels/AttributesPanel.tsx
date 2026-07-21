'use client';

import { ChevronDown, Plus } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/typography';

import { AMENITY_ATTRIBUTE_GROUPS, makeFieldId, type FamilyKey } from '../../businessContextModel';
import { FamilyActions, FamilyError, FamilyStatus } from '../DiscoveryPanelChrome';
import { AttributeAdvancedRow } from './AttributeAdvancedRow';
import {
  countSelectedAmenityAttributes,
  findAmenityAttributeRow,
  getAmenityAttributeDisplayState,
} from './attributesPanelDomain';
import { DiscoveryFamilyPanel } from './DiscoveryFamilyPanel';

import type { RestaurantBusinessContextEditor } from '../../useRestaurantBusinessContextEditor';

export function AttributesPanel({
  editor,
}: {
  embedded: boolean;
  editor: RestaurantBusinessContextEditor;
  family?: FamilyKey;
}) {
  return (
    <DiscoveryFamilyPanel>
      <FamilyStatus family="attributes" editor={editor} />

      <div className="grid gap-4 lg:grid-cols-2">
        {AMENITY_ATTRIBUTE_GROUPS.map((group) => {
          const selectedCount = countSelectedAmenityAttributes(group, editor.attributes);

          return (
            <div
              key={group.title}
              className="flex flex-col gap-4 rounded-lg border border-border/60 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Text variant="label">{group.title}</Text>
                  <Text variant="caption">{group.description}</Text>
                </div>
                <Badge variant="outline">
                  {selectedCount}/{group.keys.length}
                </Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {group.keys.map((definition) => {
                  const row = findAmenityAttributeRow(editor.attributes, definition);
                  const displayState = getAmenityAttributeDisplayState(row);

                  return (
                    <Label
                      key={definition.key}
                      htmlFor={makeFieldId('attributes', definition.key, 'amenity')}
                      className="flex cursor-pointer items-start gap-3 rounded-md border border-border/50 bg-background p-3 transition-colors hover:bg-muted/30"
                    >
                      <Checkbox
                        id={makeFieldId('attributes', definition.key, 'amenity')}
                        checked={displayState.checked}
                        onCheckedChange={(value) =>
                          editor.toggleAmenityAttribute(definition, group.title, value === true)
                        }
                      />
                      <span className="flex min-w-0 flex-col gap-1">
                        <span className="text-sm leading-5 text-foreground">
                          {definition.label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {displayState.helperText}
                        </span>
                      </span>
                    </Label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <Collapsible className="rounded-lg border border-border/60 bg-muted/20 p-3">
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="group h-auto w-full items-start justify-between whitespace-normal px-0 py-0 text-left hover:bg-transparent"
          >
            <span className="flex min-w-0 flex-col gap-1">
              <span className="text-sm font-medium text-foreground">Advanced attribute rows</span>
              <span className="text-xs font-normal text-muted-foreground">
                Review provider keys, text values, enum values, and raw payloads.
              </span>
            </span>
            <ChevronDown className="ml-4 size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4">
          {editor.attributes.length > 0 ? (
            <div className="flex flex-col gap-4">
              {editor.attributes.map((row) => (
                <AttributeAdvancedRow key={row.id} row={row} editor={editor} />
              ))}
            </div>
          ) : (
            <Text variant="caption">No attribute rows yet.</Text>
          )}
        </CollapsibleContent>
      </Collapsible>

      <FamilyActions family="attributes" editor={editor} saveLabel="Save attributes">
        <Button type="button" variant="outline" onClick={editor.addAttribute}>
          <Plus className="size-4" />
          Add attribute
        </Button>
      </FamilyActions>
      <FamilyError family="attributes" editor={editor} />
    </DiscoveryFamilyPanel>
  );
}
