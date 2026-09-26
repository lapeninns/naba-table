'use client';

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
  type AttributeFieldSpec,
} from './attributesPanelDomain';
import { makeFieldId, type AttributeEditor } from '../../businessContextModel';
import {
  DiscoveryDisclosure,
  DiscoveryFieldError,
  useDiscoveryField,
} from '../DiscoveryFormContext';
import { DISCOVERY_DISCLOSURE_IDS } from '../discoveryValidation';

import type { RestaurantBusinessContextEditor } from '../../useRestaurantBusinessContextEditor';

type AttributeFieldsEditor = Pick<RestaurantBusinessContextEditor, 'updateAttribute'>;

type AttributeFieldProps = {
  row: AttributeEditor;
  editor: AttributeFieldsEditor;
};

/** Machine-readable attribute fields, shown in the mono font. */
const MONO_FIELDS = new Set<keyof AttributeEditor>([
  'attributeKey',
  'attributeName',
  'attributeId',
  'valueType',
  'uriValue',
  'uriValuesText',
  'enumValuesText',
  'unsetEnumValuesText',
]);

function AttributeInputField({
  row,
  editor,
  spec,
  multiline = false,
}: AttributeFieldProps & { spec: AttributeFieldSpec; multiline?: boolean }) {
  const fieldId = makeFieldId('attributes', row.id, spec.field);
  const { issue, fieldProps } = useDiscoveryField(fieldId);
  const value = row[spec.field];
  const onChange = (next: string) => editor.updateAttribute(row.id, spec.field, next);

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Label htmlFor={fieldId}>{spec.label}</Label>
      {multiline ? (
        <Textarea
          {...fieldProps}
          value={value}
          rows={4}
          className="font-mono text-xs"
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <Input
          {...fieldProps}
          value={value}
          className={MONO_FIELDS.has(spec.field) ? 'font-mono' : undefined}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      <DiscoveryFieldError fieldId={fieldId} issue={issue} />
    </div>
  );
}

export function AttributeAdvancedTextFields({ row, editor }: AttributeFieldProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {ATTRIBUTE_ADVANCED_TEXT_FIELDS.map((spec) => (
        <AttributeInputField key={spec.field} row={row} editor={editor} spec={spec} />
      ))}
    </div>
  );
}

export function AttributeAdvancedScalarValueFields({ row, editor }: AttributeFieldProps) {
  const boolFieldId = makeFieldId('attributes', row.id, 'boolValue');

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="flex min-w-0 flex-col gap-2">
        <Label htmlFor={boolFieldId}>Yes or no value</Label>
        <Select
          value={row.boolValue}
          onValueChange={(value) => {
            const option = ATTRIBUTE_ADVANCED_BOOL_OPTIONS.find((item) => item.value === value);
            if (option) {
              editor.updateAttribute(row.id, 'boolValue', option.value);
            }
          }}
        >
          <SelectTrigger id={boolFieldId} className="w-full">
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
      <AttributeInputField
        row={row}
        editor={editor}
        spec={{ label: 'Text value', field: 'textValue' }}
      />
      <AttributeInputField
        row={row}
        editor={editor}
        spec={{ label: 'Primary link', field: 'uriValue' }}
      />
    </div>
  );
}

export function AttributeAdvancedGuestValueFields({ row, editor }: AttributeFieldProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {ATTRIBUTE_ADVANCED_VALUE_FIELDS.map((spec) => (
        <AttributeInputField key={spec.field} row={row} editor={editor} spec={spec} />
      ))}
    </div>
  );
}

export function AttributeAdvancedJsonFields({ row, editor }: AttributeFieldProps) {
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <AttributeInputField
        row={row}
        editor={editor}
        spec={{ label: 'Value details (JSON array)', field: 'valueMetadataJson' }}
        multiline
      />
      <DiscoveryDisclosure
        id={DISCOVERY_DISCLOSURE_IDS.attributePayload(row.id)}
        title="Provider payload fields"
        hint="JSON objects"
      >
        <div className="grid gap-3 lg:grid-cols-3">
          {ATTRIBUTE_ADVANCED_JSON_FIELDS.map((spec) => (
            <AttributeInputField key={spec.field} row={row} editor={editor} spec={spec} multiline />
          ))}
        </div>
      </DiscoveryDisclosure>
    </div>
  );
}
