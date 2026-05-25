import type { BusinessDetailsEditor } from '../../businessContextModel';

export type BusinessDetailsDateFieldSpec = {
  id: string;
  label: string;
  field: Extract<keyof BusinessDetailsEditor, 'openingDate'>;
  helperText: string;
  type: 'date';
};

export type BusinessDetailsStatusOption = {
  label: string;
  value: BusinessDetailsEditor['businessStatus'];
};

export type BusinessDetailsSwitchSpec = {
  id: string;
  label: string;
  field: Extract<keyof BusinessDetailsEditor, 'isServiceAreaBusiness'>;
  helperText: string;
};

export const BUSINESS_DETAILS_OPENING_DATE_FIELD = {
  id: 'business-details-opening-date',
  label: 'Opening date',
  field: 'openingDate',
  helperText: 'Optional public opening date for the venue.',
  type: 'date',
} satisfies BusinessDetailsDateFieldSpec;

export const BUSINESS_DETAILS_STATUS_FIELD = {
  id: 'business-details-status',
  label: 'Business status',
  helperText: 'Optional public status for profile checks and listings.',
} as const;

export const BUSINESS_DETAILS_STATUS_OPTIONS = [
  { value: 'unset', label: 'Unset' },
  { value: 'open', label: 'Open' },
  { value: 'closed_temporarily', label: 'Closed temporarily' },
  { value: 'closed_permanently', label: 'Closed permanently' },
] satisfies BusinessDetailsStatusOption[];

export const BUSINESS_DETAILS_SERVICE_AREA_FIELD = {
  id: 'business-details-service-area-business',
  label: 'Service-area business',
  field: 'isServiceAreaBusiness',
  helperText: 'Mark this when the restaurant serves guests beyond the venue.',
} satisfies BusinessDetailsSwitchSpec;
