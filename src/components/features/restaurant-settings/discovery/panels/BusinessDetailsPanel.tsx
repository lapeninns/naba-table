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
import { Text } from '@/components/ui/typography';

import {
  BUSINESS_DETAILS_OPENING_DATE_FIELD,
  BUSINESS_DETAILS_STATUS_FIELD,
  BUSINESS_DETAILS_STATUS_OPTIONS,
} from './businessDetailsPanelDomain';
import { RestaurantSettingsDatePickerField } from '../../RestaurantSettingsDatePickerField';

import type { BusinessDetailsEditor } from '../../businessContextModel';
import type { RestaurantBusinessContextEditor } from '../../useRestaurantBusinessContextEditor';

type BusinessDetailsPanelEditor = Pick<
  RestaurantBusinessContextEditor,
  'businessDetails' | 'updateBusinessDetails'
>;

function isBusinessStatus(value: string): value is BusinessDetailsEditor['businessStatus'] {
  return BUSINESS_DETAILS_STATUS_OPTIONS.some((option) => option.value === value);
}

/** Section 1: business status and opening date. Serving off-site is set under Where you serve. */
export function BusinessDetailsPanel({ editor }: { editor: BusinessDetailsPanelEditor }) {
  const statusHelpId = `${BUSINESS_DETAILS_STATUS_FIELD.id}-help`;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-2">
        <Label htmlFor={BUSINESS_DETAILS_STATUS_FIELD.id}>
          {BUSINESS_DETAILS_STATUS_FIELD.label}
        </Label>
        <Select
          value={editor.businessDetails.businessStatus}
          onValueChange={(value) => {
            if (isBusinessStatus(value)) {
              editor.updateBusinessDetails('businessStatus', value);
            }
          }}
        >
          <SelectTrigger
            id={BUSINESS_DETAILS_STATUS_FIELD.id}
            aria-describedby={statusHelpId}
            className="w-full [@media(pointer:coarse)]:min-h-11"
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
        <Text variant="caption" id={statusHelpId}>
          {BUSINESS_DETAILS_STATUS_FIELD.helperText}
        </Text>
      </div>

      <RestaurantSettingsDatePickerField
        id={BUSINESS_DETAILS_OPENING_DATE_FIELD.id}
        label={BUSINESS_DETAILS_OPENING_DATE_FIELD.label}
        value={editor.businessDetails.openingDate}
        onChange={(openingDate) =>
          editor.updateBusinessDetails(BUSINESS_DETAILS_OPENING_DATE_FIELD.field, openingDate)
        }
        description={BUSINESS_DETAILS_OPENING_DATE_FIELD.helperText}
      />
    </div>
  );
}
