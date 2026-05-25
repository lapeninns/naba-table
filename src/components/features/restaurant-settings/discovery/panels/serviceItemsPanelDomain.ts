import type { ServiceItemEditor } from '../../businessContextModel';

export type ServiceItemFieldSpec = {
  label: string;
  field: keyof ServiceItemEditor;
};

export const SERVICE_ITEM_MAIN_FIELDS = [
  { label: 'Service code', field: 'itemKey' },
  { label: 'Service type', field: 'itemType' },
  { label: 'Display name', field: 'displayName' },
  { label: 'Description', field: 'description' },
] satisfies ServiceItemFieldSpec[];

export function getServiceItemRowTitle(row: ServiceItemEditor): string {
  return row.displayName || row.itemKey || 'New service item';
}
