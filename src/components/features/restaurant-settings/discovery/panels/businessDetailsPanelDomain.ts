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
  helperText: 'Optional.',
  type: 'date',
} satisfies BusinessDetailsDateFieldSpec;

export const BUSINESS_DETAILS_STATUS_FIELD = {
  id: 'business-details-status',
  label: 'Business status',
  helperText: 'Shown on public listings.',
} as const;

export const BUSINESS_DETAILS_STATUS_OPTIONS = [
  { value: 'unset', label: 'Not set' },
  { value: 'open', label: 'Open' },
  { value: 'closed_temporarily', label: 'Closed temporarily' },
  { value: 'closed_permanently', label: 'Closed permanently' },
] satisfies BusinessDetailsStatusOption[];

export const BUSINESS_DETAILS_SERVICE_AREA_FIELD = {
  id: 'business-details-service-area-business',
  label: 'We serve customers at their location',
  field: 'isServiceAreaBusiness',
  helperText: 'For delivery or catering. Add the towns or areas you serve below.',
} satisfies BusinessDetailsSwitchSpec;
