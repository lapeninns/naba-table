'use client';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/typography';

import {
  BUSINESS_DETAILS_OPENING_DATE_FIELD,
  BUSINESS_DETAILS_SERVICE_AREA_FIELD,
  BUSINESS_DETAILS_STATUS_FIELD,
  BUSINESS_DETAILS_STATUS_OPTIONS,
} from './businessDetailsPanelDomain';
import { RestaurantSettingsDatePickerField } from '../../RestaurantSettingsDatePickerField';

import type { RestaurantBusinessContextEditor } from '../../useRestaurantBusinessContextEditor';

export function BusinessDetailsForm({ editor }: { editor: RestaurantBusinessContextEditor }) {
  return (
    <div className="space-y-4 rounded-xl border border-border/60 p-4">
      <div className="grid gap-4 md:grid-cols-2">
        <RestaurantSettingsDatePickerField
          id={BUSINESS_DETAILS_OPENING_DATE_FIELD.id}
          label={BUSINESS_DETAILS_OPENING_DATE_FIELD.label}
          value={editor.businessDetails.openingDate}
          onChange={(openingDate) =>
            editor.updateBusinessDetails(BUSINESS_DETAILS_OPENING_DATE_FIELD.field, openingDate)
          }
          description={BUSINESS_DETAILS_OPENING_DATE_FIELD.helperText}
        />
        <div className="space-y-2">
          <Label htmlFor={BUSINESS_DETAILS_STATUS_FIELD.id}>
            {BUSINESS_DETAILS_STATUS_FIELD.label}
          </Label>
          <Select
            value={editor.businessDetails.businessStatus}
            onValueChange={(value) =>
              editor.updateBusinessDetails(
                'businessStatus',
                value as (typeof BUSINESS_DETAILS_STATUS_OPTIONS)[number]['value'],
              )
            }
          >
            <SelectTrigger
              id={BUSINESS_DETAILS_STATUS_FIELD.id}
              aria-label={BUSINESS_DETAILS_STATUS_FIELD.label}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {BUSINESS_DETAILS_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Text variant="caption">
            {BUSINESS_DETAILS_STATUS_FIELD.helperText}
          </Text>
        </div>
      </div>

      <div className="flex items-start gap-3 border-t border-border/60 pt-4">
        <Switch
          id={BUSINESS_DETAILS_SERVICE_AREA_FIELD.id}
          checked={editor.businessDetails.isServiceAreaBusiness}
          onCheckedChange={(checked) =>
            editor.updateBusinessDetails(BUSINESS_DETAILS_SERVICE_AREA_FIELD.field, checked)
          }
        />
        <div className="space-y-1">
          <Label htmlFor={BUSINESS_DETAILS_SERVICE_AREA_FIELD.id}>
            {BUSINESS_DETAILS_SERVICE_AREA_FIELD.label}
          </Label>
          <Text variant="caption">
            {BUSINESS_DETAILS_SERVICE_AREA_FIELD.helperText}
          </Text>
        </div>
      </div>
    </div>
  );
}
