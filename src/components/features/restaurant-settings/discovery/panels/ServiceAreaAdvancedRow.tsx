'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import {
  getServiceAreaAdvancedSubtitle,
  getServiceAreaChipLabel,
  SERVICE_AREA_MAIN_FIELDS,
  SERVICE_AREA_PROVIDER_FIELDS,
  type ServiceAreaFieldSpec,
} from './serviceAreasPanelDomain';
import { makeFieldId, type ServiceAreaEditor } from '../../businessContextModel';
import {
  DiscoveryDisclosure,
  DiscoveryFieldError,
  useDiscoveryField,
} from '../DiscoveryFormContext';
import { DISCOVERY_DISCLOSURE_IDS } from '../discoveryValidation';

import type { RestaurantBusinessContextEditor } from '../../useRestaurantBusinessContextEditor';

type ServiceAreaRowEditor = Pick<RestaurantBusinessContextEditor, 'updateServiceArea'>;

const MONO_FIELDS = new Set<keyof ServiceAreaEditor>([
  'areaType',
  'regionCode',
  'googlePlaceId',
  'googlePlaceResourceName',
]);

function ServiceAreaField({
  row,
  editor,
  spec,
}: {
  row: ServiceAreaEditor;
  editor: ServiceAreaRowEditor;
  spec: ServiceAreaFieldSpec;
}) {
  const fieldId = makeFieldId('serviceAreas', row.id, spec.field);
  const { issue, fieldProps } = useDiscoveryField(fieldId);

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Label htmlFor={fieldId}>{spec.label}</Label>
      <Input
        {...fieldProps}
        value={row[spec.field]}
        className={MONO_FIELDS.has(spec.field) ? 'font-mono' : undefined}
        onChange={(event) => editor.updateServiceArea(row.id, spec.field, event.target.value)}
      />
      <DiscoveryFieldError fieldId={fieldId} issue={issue} />
    </div>
  );
}

/** Advanced details of one area: type, region, Google place and raw place data. */
export function ServiceAreaAdvancedRow({
  row,
  editor,
}: {
  row: ServiceAreaEditor;
  editor: ServiceAreaRowEditor;
}) {
  const placeDataId = makeFieldId('serviceAreas', row.id, 'placeDataJson');
  const placeData = useDiscoveryField(placeDataId);

  return (
    <fieldset className="flex min-w-0 flex-col gap-3 rounded-lg border border-border/60 p-3">
      <legend className="px-1 text-sm font-semibold text-foreground">
        {getServiceAreaChipLabel(row)}
        <span className="ml-2 font-mono text-xs font-normal text-muted-foreground">
          {getServiceAreaAdvancedSubtitle(row)}
        </span>
      </legend>
      <div className="grid gap-3 sm:grid-cols-3">
        {SERVICE_AREA_MAIN_FIELDS.map((spec) => (
          <ServiceAreaField key={spec.field} row={row} editor={editor} spec={spec} />
        ))}
      </div>
      <DiscoveryDisclosure
        id={DISCOVERY_DISCLOSURE_IDS.serviceAreaPayload(row.id)}
        title="Google place fields"
        hint="For support"
      >
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {SERVICE_AREA_PROVIDER_FIELDS.map((spec) => (
              <ServiceAreaField key={spec.field} row={row} editor={editor} spec={spec} />
            ))}
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <Label htmlFor={placeDataId}>Place data (JSON object)</Label>
            <Textarea
              {...placeData.fieldProps}
              value={row.placeDataJson}
              rows={4}
              className="font-mono text-xs"
              onChange={(event) =>
                editor.updateServiceArea(row.id, 'placeDataJson', event.target.value)
              }
            />
            <DiscoveryFieldError fieldId={placeDataId} issue={placeData.issue} />
          </div>
        </div>
      </DiscoveryDisclosure>
    </fieldset>
  );
}
