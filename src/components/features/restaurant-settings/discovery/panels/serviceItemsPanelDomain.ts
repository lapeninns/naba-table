import type { ServiceItemEditor } from '../../businessContextModel';

export type ServiceItemFieldSpec = {
  label: string;
  field: keyof ServiceItemEditor;
};

export const SERVICE_ITEM_MAIN_FIELDS = [
  { label: 'Service', field: 'displayName' },
  { label: 'Description', field: 'description' },
] satisfies ServiceItemFieldSpec[];

/** Machine values, kept under Advanced. */
export const SERVICE_ITEM_ADVANCED_FIELDS = [
  { label: 'Service code', field: 'itemKey' },
  { label: 'Service type', field: 'itemType' },
] satisfies ServiceItemFieldSpec[];

export function getServiceItemRowTitle(row: ServiceItemEditor): string {
  return row.displayName || row.itemKey || 'New service';
}
