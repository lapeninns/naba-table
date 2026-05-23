import { formatServiceAreaTitle, type ServiceAreaEditor } from '../../businessContextModel';

export type ServiceAreaFieldSpec = {
  label: string;
  field: keyof ServiceAreaEditor;
};

export const SERVICE_AREA_MAIN_FIELDS = [
  { label: 'Area name', field: 'displayName' },
  { label: 'Area type', field: 'areaType' },
  { label: 'Country or region', field: 'regionCode' },
] satisfies ServiceAreaFieldSpec[];

export const SERVICE_AREA_PROVIDER_FIELDS = [
  { label: 'Google place ID', field: 'googlePlaceId' },
  { label: 'Place resource', field: 'googlePlaceResourceName' },
] satisfies ServiceAreaFieldSpec[];

export function getServiceAreaChipLabel(row: ServiceAreaEditor): string {
  return formatServiceAreaTitle(row);
}

export function getServiceAreaAdvancedSubtitle(row: ServiceAreaEditor): string {
  const areaType = row.areaType || 'region';
  return row.regionCode ? `${areaType} · ${row.regionCode}` : areaType;
}
