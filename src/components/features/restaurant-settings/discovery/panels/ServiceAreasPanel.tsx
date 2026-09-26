'use client';

import { Plus, X } from 'lucide-react';
import { memo, useState, type KeyboardEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/typography';

import { BUSINESS_DETAILS_SERVICE_AREA_FIELD } from './businessDetailsPanelDomain';
import { DISCOVERY_CHIP_BUTTON_CLASS, DISCOVERY_CHIP_CLASS } from './CategoriesPanel';
import { ServiceAreaAdvancedRow } from './ServiceAreaAdvancedRow';
import { getServiceAreaChipLabel } from './serviceAreasPanelDomain';
import { DiscoveryDisclosure, useDiscoveryForm } from '../DiscoveryFormContext';
import { DISCOVERY_DISCLOSURE_IDS, DISCOVERY_FIELD_IDS } from '../discoveryValidation';

import type { BusinessDetailsEditor } from '../../businessContextModel';
import type { RestaurantBusinessContextEditor } from '../../useRestaurantBusinessContextEditor';

export type ServiceAreasPanelEditor = Pick<
  RestaurantBusinessContextEditor,
  | 'serviceAreas'
  | 'addServiceArea'
  | 'updateServiceArea'
  | 'removeServiceArea'
  | 'updateBusinessDetails'
> & {
  /** Only the service-location switch, so business status edits leave this panel alone. */
  businessDetails: Pick<BusinessDetailsEditor, 'isServiceAreaBusiness'>;
};

/**
 * Section 6: whether the restaurant serves customers away from the venue, and the towns or
 * areas it serves. Turning the switch off never removes saved areas; staff remove them here.
 */
export const ServiceAreasPanel = memo(function ServiceAreasPanel({
  editor,
}: {
  editor: ServiceAreasPanelEditor;
}) {
  const { requestFocus } = useDiscoveryForm();
  const [newArea, setNewArea] = useState('');
  const servesAway = editor.businessDetails.isServiceAreaBusiness;
  const hasAreas = editor.serviceAreas.length > 0;
  const switchHelpId = `${BUSINESS_DETAILS_SERVICE_AREA_FIELD.id}-help`;

  const addArea = () => {
    if (editor.addServiceArea(newArea)) {
      setNewArea('');
    }
    requestFocus(DISCOVERY_FIELD_IDS.newServiceArea);
  };

  return (
    <>
      <div className="flex items-start gap-3">
        <Switch
          id={BUSINESS_DETAILS_SERVICE_AREA_FIELD.id}
          aria-describedby={switchHelpId}
          checked={servesAway}
          onCheckedChange={(checked) =>
            editor.updateBusinessDetails(BUSINESS_DETAILS_SERVICE_AREA_FIELD.field, checked)
          }
        />
        <div className="flex min-w-0 flex-col gap-1">
          <Label htmlFor={BUSINESS_DETAILS_SERVICE_AREA_FIELD.id}>
            {BUSINESS_DETAILS_SERVICE_AREA_FIELD.label}
          </Label>
          <Text variant="caption" id={switchHelpId}>
            {BUSINESS_DETAILS_SERVICE_AREA_FIELD.helperText}
          </Text>
        </div>
      </div>

      {!servesAway && hasAreas ? (
        <Text variant="caption" role="note">
          These areas are kept while this is off. Remove any you no longer serve.
        </Text>
      ) : null}

      {hasAreas ? (
        <ul className="flex flex-wrap gap-2" aria-label="Areas you serve">
          {editor.serviceAreas.map((row) => {
            const label = getServiceAreaChipLabel(row);
            return (
              <li key={row.id} className={DISCOVERY_CHIP_CLASS}>
                <span className="min-w-0 truncate">{label}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className={DISCOVERY_CHIP_BUTTON_CLASS}
                  aria-label={`Remove ${label}`}
                  onClick={() => {
                    editor.removeServiceArea(row.id);
                    // With the switch off, the add field goes away with the last area.
                    requestFocus(
                      servesAway || editor.serviceAreas.length > 1
                        ? DISCOVERY_FIELD_IDS.newServiceArea
                        : BUSINESS_DETAILS_SERVICE_AREA_FIELD.id,
                    );
                  }}
                >
                  <X className="size-3.5" aria-hidden />
                </Button>
              </li>
            );
          })}
        </ul>
      ) : servesAway ? (
        <Text variant="caption">No areas yet. Add the towns or areas you serve.</Text>
      ) : (
        <Text variant="caption">No areas. Guests come to you.</Text>
      )}

      {servesAway || hasAreas ? (
        <div className="flex flex-wrap gap-2">
          <Label htmlFor={DISCOVERY_FIELD_IDS.newServiceArea} className="sr-only">
            New area
          </Label>
          <Input
            id={DISCOVERY_FIELD_IDS.newServiceArea}
            value={newArea}
            placeholder="Add an area, e.g. Cambridge, UK"
            className="min-w-0 flex-[1_1_12rem] [@media(pointer:coarse)]:min-h-11"
            onChange={(event) => setNewArea(event.target.value)}
            onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addArea();
              }
            }}
          />
          <Button type="button" variant="outline" onClick={addArea}>
            <Plus data-icon="inline-start" aria-hidden />
            Add
          </Button>
        </div>
      ) : null}

      {editor.serviceAreas.length > 0 ? (
        <DiscoveryDisclosure
          id={DISCOVERY_DISCLOSURE_IDS.serviceAreasAdvanced}
          title="Area details"
          hint="Advanced"
        >
          <div className="flex flex-col gap-3">
            {editor.serviceAreas.map((row) => (
              <ServiceAreaAdvancedRow key={row.id} row={row} editor={editor} />
            ))}
          </div>
        </DiscoveryDisclosure>
      ) : null}
    </>
  );
});
