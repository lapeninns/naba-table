'use client';

import { ChevronDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

import {
  ATTRIBUTE_ADVANCED_BOOL_OPTIONS,
  ATTRIBUTE_ADVANCED_JSON_FIELDS,
  ATTRIBUTE_ADVANCED_TEXT_FIELDS,
  ATTRIBUTE_ADVANCED_VALUE_FIELDS,
} from './attributesPanelDomain';
import { makeFieldId, type AttributeEditor } from '../../businessContextModel';

import type { RestaurantBusinessContextEditor } from '../../useRestaurantBusinessContextEditor';

export function AttributeAdvancedTextFields({
  row,
  editor,
}: {
  row: AttributeEditor;
  editor: RestaurantBusinessContextEditor;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {ATTRIBUTE_ADVANCED_TEXT_FIELDS.map(({ label, field }) => (
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
  );
}

export function AttributeAdvancedScalarValueFields({
  row,
  editor,
}: {
  row: AttributeEditor;
  editor: RestaurantBusinessContextEditor;
}) {
  return (
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
            <SelectGroup>
              {ATTRIBUTE_ADVANCED_BOOL_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
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
  );
}

export function AttributeAdvancedGuestValueFields({
  row,
  editor,
}: {
  row: AttributeEditor;
  editor: RestaurantBusinessContextEditor;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {ATTRIBUTE_ADVANCED_VALUE_FIELDS.map(({ label, field }) => (
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
  );
}

export function AttributeAdvancedJsonFields({
  row,
  editor,
}: {
  row: AttributeEditor;
  editor: RestaurantBusinessContextEditor;
}) {
  return (
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
            {ATTRIBUTE_ADVANCED_JSON_FIELDS.map(({ label, field }) => (
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
  );
}
