'use client';

import { ChevronDown, Plus, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

import {
  AMENITY_ATTRIBUTE_GROUPS,
  AMENITY_ATTRIBUTE_KEYS,
  formatAttributeTitle,
  makeFieldId,
  type AttributeEditor,
  type FamilyKey,
} from '../../businessContextModel';
import { FamilyActions, FamilyError, FamilyStatus } from '../DiscoveryPanelChrome';
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
          const selectedCount = group.keys.filter(
            (definition) =>
              editor.attributes.find((row) => row.attributeKey === definition.key)?.boolValue ===
              'true',
          ).length;

          return (
            <div
              key={group.title}
              className="flex flex-col gap-4 rounded-lg border border-border/60 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{group.title}</p>
                  <p className="text-xs leading-5 text-muted-foreground">{group.description}</p>
                </div>
                <Badge variant="outline">
                  {selectedCount}/{group.keys.length}
                </Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {group.keys.map((definition) => {
                  const row = editor.attributes.find(
                    (item) => item.attributeKey === definition.key,
                  );
                  const checked = row?.boolValue === 'true';

                  return (
                    <Label
                      key={definition.key}
                      htmlFor={makeFieldId('attributes', definition.key, 'amenity')}
                      className="flex cursor-pointer items-start gap-3 rounded-md border border-border/50 bg-background p-3 transition-colors hover:bg-muted/30"
                    >
                      <Checkbox
                        id={makeFieldId('attributes', definition.key, 'amenity')}
                        checked={checked}
                        onCheckedChange={(value) =>
                          editor.toggleAmenityAttribute(definition, group.title, value === true)
                        }
                      />
                      <span className="flex min-w-0 flex-col gap-1">
                        <span className="text-sm leading-5 text-foreground">
                          {definition.label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {row
                            ? row.boolValue === 'false'
                              ? 'Saved as no'
                              : 'Saved detail'
                            : 'Not set'}
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
            <p className="text-sm text-muted-foreground">No attribute rows yet.</p>
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

function AttributeAdvancedRow({
  row,
  editor,
}: {
  row: AttributeEditor;
  editor: RestaurantBusinessContextEditor;
}) {
  const textFields: Array<[string, keyof AttributeEditor]> = [
    ['Group', 'attributeGroup'],
    ['Key', 'attributeKey'],
    ['Name', 'attributeName'],
    ['Reference ID', 'attributeId'],
    ['Display name', 'displayName'],
    ['Value type', 'valueType'],
  ];
  const valueFields: Array<[string, keyof AttributeEditor]> = [
    ['Guest-facing text', 'displayText'],
    ['Standalone text', 'displayTextStandalone'],
    ['Text when unavailable', 'displayTextNegative'],
    ['Link values, comma separated', 'uriValuesText'],
    ['Selected values, comma separated', 'enumValuesText'],
    ['Excluded values, comma separated', 'unsetEnumValuesText'],
  ];
  const jsonFields: Array<[string, keyof AttributeEditor]> = [
    ['Raw value', 'rawValueJson'],
    ['Raw selected values', 'rawEnumValuesJson'],
    ['Display value', 'displayValueJson'],
  ];

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border/60 bg-background p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {formatAttributeTitle(row)}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {AMENITY_ATTRIBUTE_KEYS.has(row.attributeKey)
              ? 'Shown in grouped amenities'
              : row.attributeKey || 'No key set'}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.removeAttribute(row.id)}
        >
          <Trash2 className="size-4" />
          Remove
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {textFields.map(([label, field]) => (
          <div key={field} className="space-y-2">
            <Label htmlFor={makeFieldId('attributes', row.id, field)}>{label}</Label>
            <Input
              id={makeFieldId('attributes', row.id, field)}
              value={row[field] as string}
              onChange={(event) => editor.updateAttribute(row.id, field, event.target.value)}
            />
          </div>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor={makeFieldId('attributes', row.id, 'boolValue')}>Boolean value</Label>
          <Select
            value={row.boolValue}
            onValueChange={(value) =>
              editor.updateAttribute(row.id, 'boolValue', value as AttributeEditor['boolValue'])
            }
          >
            <SelectTrigger
              id={makeFieldId('attributes', row.id, 'boolValue')}
              aria-label="Boolean value"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unset">Unset</SelectItem>
              <SelectItem value="true">True</SelectItem>
              <SelectItem value="false">False</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={makeFieldId('attributes', row.id, 'textValue')}>Text value</Label>
          <Input
            id={makeFieldId('attributes', row.id, 'textValue')}
            value={row.textValue}
            onChange={(event) => editor.updateAttribute(row.id, 'textValue', event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={makeFieldId('attributes', row.id, 'uriValue')}>Primary URI</Label>
          <Input
            id={makeFieldId('attributes', row.id, 'uriValue')}
            value={row.uriValue}
            onChange={(event) => editor.updateAttribute(row.id, 'uriValue', event.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {valueFields.map(([label, field]) => (
          <div key={field} className="space-y-2">
            <Label htmlFor={makeFieldId('attributes', row.id, field)}>{label}</Label>
            <Input
              id={makeFieldId('attributes', row.id, field)}
              value={row[field] as string}
              onChange={(event) => editor.updateAttribute(row.id, field, event.target.value)}
            />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-4 rounded-lg border border-border/60 bg-muted/20 p-3">
        <div className="space-y-2">
          <Label htmlFor={makeFieldId('attributes', row.id, 'valueMetadataJson')}>
            Value details
          </Label>
          <Textarea
            id={makeFieldId('attributes', row.id, 'valueMetadataJson')}
            value={row.valueMetadataJson}
            rows={5}
            onChange={(event) =>
              editor.updateAttribute(row.id, 'valueMetadataJson', event.target.value)
            }
          />
        </div>
        <Collapsible
          defaultOpen={false}
          className="rounded-md border border-border/50 bg-muted/10 p-2.5"
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
                  Raw value JSON, enum value JSON, and display value JSON from providers.
                </span>
              </span>
              <ChevronDown className="ml-4 size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4">
            <div className="grid gap-4 lg:grid-cols-3">
              {jsonFields.map(([label, field]) => (
                <div key={field} className="space-y-2">
                  <Label htmlFor={makeFieldId('attributes', row.id, field)}>{label}</Label>
                  <Textarea
                    id={makeFieldId('attributes', row.id, field)}
                    value={row[field] as string}
                    rows={5}
                    onChange={(event) => editor.updateAttribute(row.id, field, event.target.value)}
                  />
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
