import { LINK_TYPE_OPTIONS, type LinkEditor } from '../../businessContextModel';

export type LinkTextFieldSpec = {
  label: string;
  field: Extract<keyof LinkEditor, 'label' | 'url'>;
  placeholder: string;
  inputMode?: 'url';
  type?: 'url';
};

export const LINK_TEXT_FIELDS = [
  { label: 'Label', field: 'label', placeholder: 'Website' },
  {
    label: 'URL',
    field: 'url',
    placeholder: 'https://example.com',
    inputMode: 'url',
    type: 'url',
  },
] satisfies LinkTextFieldSpec[];

export function getLinkTypeLabel(linkType: string): string | null {
  return LINK_TYPE_OPTIONS.find((option) => option.value === linkType)?.label ?? null;
}

export function getLinkRowTitle(row: LinkEditor): string {
  return row.label || getLinkTypeLabel(row.linkType) || 'New link';
}

export function getLinkRemoveLabel(row: LinkEditor): string {
  return row.label || row.linkType || 'link';
}
