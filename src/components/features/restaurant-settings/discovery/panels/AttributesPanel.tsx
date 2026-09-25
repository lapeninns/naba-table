'use client';

import { ChevronRight, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/typography';

import { AttributeAdvancedRow } from './AttributeAdvancedRow';
import {
  AMENITY_VALUE_OPTIONS,
  countSetAmenityAttributes,
  findAmenityAttributeRow,
  getAmenityAttributeValue,
} from './attributesPanelDomain';
import {
  AMENITY_ATTRIBUTE_GROUPS,
  makeFieldId,
  type AmenityAttributeDefinition,
  type AmenityAttributeGroup,
  type AttributeEditor,
} from '../../businessContextModel';
import { DiscoveryDisclosure, useDiscoveryForm } from '../DiscoveryFormContext';
import { DISCOVERY_DISCLOSURE_IDS, DISCOVERY_FIELD_IDS } from '../discoveryValidation';

import type { RestaurantBusinessContextEditor } from '../../useRestaurantBusinessContextEditor';

type AttributesPanelEditor = Pick<
  RestaurantBusinessContextEditor,
  'attributes' | 'setAmenityValue' | 'addAttribute' | 'updateAttribute' | 'removeAttribute'
>;

/** One amenity: a native Yes / No / Not set radio group. */
function AmenityValueRadios({
  definition,
  groupTitle,
  row,
  editor,
}: {
  definition: AmenityAttributeDefinition;
  groupTitle: string;
  row: AttributeEditor | undefined;
  editor: AttributesPanelEditor;
}) {
  const name = makeFieldId('attributes', definition.key, 'amenity');
  const labelId = `${name}-label`;
  const value = getAmenityAttributeValue(row);

  return (
    <li className="flex min-h-11 items-center justify-between gap-3 border-b border-border/60 py-1.5 last:border-b-0">
      <span id={labelId} className="min-w-0 text-sm text-foreground">
        {definition.label}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className="inline-flex shrink-0 gap-0.5 rounded-md border border-border p-0.5"
      >
        {AMENITY_VALUE_OPTIONS.map((option) => (
          <Label key={option.value} className="relative gap-0">
            {/* A native radio: arrow keys move between Yes, No and Not set. */}
            <Input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => editor.setAmenityValue(definition, groupTitle, option.value)}
              className="peer absolute inset-0 m-0 size-full cursor-pointer appearance-none border-0 p-0 opacity-0 shadow-none"
            />
            <span className="grid min-h-7 min-w-11 cursor-pointer place-items-center rounded-sm px-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-1 motion-reduce:transition-none [@media(pointer:coarse)]:min-h-9">
              {option.label}
            </span>
          </Label>
        ))}
      </div>
    </li>
  );
}

function AmenityGroup({
  group,
  index,
  editor,
}: {
  group: AmenityAttributeGroup;
  index: number;
  editor: AttributesPanelEditor;
}) {
  const { isDisclosureOpen, setDisclosureOpen } = useDiscoveryForm();
  const id = DISCOVERY_DISCLOSURE_IDS.amenityGroup(index);
  const setCount = countSetAmenityAttributes(group, editor.attributes);

  return (
    <Collapsible
      open={isDisclosureOpen(id)}
      onOpenChange={(open) => setDisclosureOpen(id, open)}
      className="border-t border-border/60 first:border-t-0"
    >
      <CollapsibleTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="group h-auto min-h-12 w-full justify-between gap-2 rounded-none px-0 py-2 text-left hover:bg-transparent"
        >
          <span className="flex min-w-0 flex-col">
            <span className="text-sm font-semibold text-foreground">{group.title}</span>
            <span className="text-xs font-normal text-muted-foreground">{group.description}</span>
          </span>
          <span className="flex shrink-0 items-center gap-2 text-xs font-normal text-muted-foreground tabular-nums">
            {setCount} of {group.keys.length} set
            <ChevronRight
              className="size-4 transition-transform group-data-[state=open]:rotate-90 motion-reduce:transition-none"
              aria-hidden
            />
          </span>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="grid pb-3 md:grid-cols-2 md:gap-x-6">
          {group.keys.map((definition) => (
            <AmenityValueRadios
              key={definition.key}
              definition={definition}
              groupTitle={group.title}
              row={findAmenityAttributeRow(editor.attributes, definition)}
              editor={editor}
            />
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Section 4: the full amenity catalogue as Yes / No / Not set, plus raw data for support. */
export function AttributesPanel({ editor }: { editor: AttributesPanelEditor }) {
  const { requestFocus } = useDiscoveryForm();

  return (
    <>
      <div className="flex flex-col">
        {AMENITY_ATTRIBUTE_GROUPS.map((group, index) => (
          <AmenityGroup key={group.title} group={group} index={index} editor={editor} />
        ))}
      </div>

      <DiscoveryDisclosure
        id={DISCOVERY_DISCLOSURE_IDS.amenitiesRaw}
        title="Raw attribute data"
        hint="Advanced, for support"
        className="border-t border-border/60 pt-2"
      >
        <div className="flex flex-col gap-3">
          <Text variant="caption">
            Only change this if support asks you to. The choices above update it for you.
          </Text>
          {editor.attributes.length > 0 ? (
            editor.attributes.map((row) => (
              <AttributeAdvancedRow
                key={row.id}
                row={row}
                editor={editor}
                onRemove={() => {
                  editor.removeAttribute(row.id);
                  requestFocus(DISCOVERY_FIELD_IDS.addAttribute);
                }}
              />
            ))
          ) : (
            <Text variant="caption">No attribute data yet.</Text>
          )}
          <div>
            <Button
              type="button"
              variant="outline"
              id={DISCOVERY_FIELD_IDS.addAttribute}
              onClick={() =>
                requestFocus(makeFieldId('attributes', editor.addAttribute(), 'attributeGroup'))
              }
            >
              <Plus data-icon="inline-start" aria-hidden />
              Add attribute
            </Button>
          </div>
        </div>
      </DiscoveryDisclosure>
    </>
  );
}
