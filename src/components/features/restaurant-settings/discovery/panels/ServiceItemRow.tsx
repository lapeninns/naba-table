'use client';

import { Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import {
  getServiceItemRowTitle,
  SERVICE_ITEM_ADVANCED_FIELDS,
  SERVICE_ITEM_MAIN_FIELDS,
  type ServiceItemFieldSpec,
} from './serviceItemsPanelDomain';
import { makeFieldId, type ServiceItemEditor } from '../../businessContextModel';
import {
  DiscoveryDisclosure,
  DiscoveryFieldError,
  useDiscoveryField,
} from '../DiscoveryFormContext';
import { DISCOVERY_DISCLOSURE_IDS } from '../discoveryValidation';

import type { RestaurantBusinessContextEditor } from '../../useRestaurantBusinessContextEditor';

type ServiceItemRowEditor = Pick<RestaurantBusinessContextEditor, 'updateServiceItem'>;

function ServiceItemField({
  row,
  editor,
  spec,
  mono = false,
  optional = false,
}: {
  row: ServiceItemEditor;
  editor: ServiceItemRowEditor;
  spec: ServiceItemFieldSpec;
  mono?: boolean;
  optional?: boolean;
}) {
  const fieldId = makeFieldId('serviceItems', row.id, spec.field);
  const { issue, fieldProps } = useDiscoveryField(fieldId);

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Label htmlFor={fieldId}>
        {spec.label}
        {optional ? <span className="font-normal text-muted-foreground"> Optional</span> : null}
      </Label>
      <Input
        {...fieldProps}
        value={row[spec.field]}
        className={
          mono ? 'font-mono [@media(pointer:coarse)]:min-h-11' : '[@media(pointer:coarse)]:min-h-11'
        }
        onChange={(event) => editor.updateServiceItem(row.id, spec.field, event.target.value)}
      />
      <DiscoveryFieldError fieldId={fieldId} issue={issue} />
    </div>
  );
}

/** One service: name and description, with its code and raw details under Advanced. */
export function ServiceItemRow({
  row,
  editor,
  onRemove,
}: {
  row: ServiceItemEditor;
  editor: ServiceItemRowEditor;
  onRemove: () => void;
}) {
  const payloadFieldId = makeFieldId('serviceItems', row.id, 'payloadJson');
  const payloadField = useDiscoveryField(payloadFieldId);

  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-lg border border-border/60 p-3">
      <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] md:items-start">
        {SERVICE_ITEM_MAIN_FIELDS.map((spec) => (
          <ServiceItemField
            key={spec.field}
            row={row}
            editor={editor}
            spec={spec}
            optional={spec.field === 'description'}
          />
        ))}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Remove ${getServiceItemRowTitle(row)}`}
          className="justify-self-end text-muted-foreground hover:text-destructive md:mt-7 [@media(pointer:coarse)]:size-11"
          onClick={onRemove}
        >
          <Trash2 className="size-4" aria-hidden />
        </Button>
      </div>
      <DiscoveryDisclosure
        id={DISCOVERY_DISCLOSURE_IDS.serviceItemAdvanced(row.id)}
        title="Service code and details"
        hint="Advanced"
      >
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {SERVICE_ITEM_ADVANCED_FIELDS.map((spec) => (
              <ServiceItemField key={spec.field} row={row} editor={editor} spec={spec} mono />
            ))}
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <Label htmlFor={payloadFieldId}>Service details (JSON object)</Label>
            <Textarea
              {...payloadField.fieldProps}
              value={row.payloadJson}
              rows={4}
              className="font-mono text-xs"
              onChange={(event) =>
                editor.updateServiceItem(row.id, 'payloadJson', event.target.value)
              }
            />
            <DiscoveryFieldError fieldId={payloadFieldId} issue={payloadField.issue} />
          </div>
        </div>
      </DiscoveryDisclosure>
    </div>
  );
}
