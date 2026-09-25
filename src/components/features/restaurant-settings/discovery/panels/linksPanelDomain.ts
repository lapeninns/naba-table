import { LINK_TYPE_OPTIONS, type LinkEditor } from '../../businessContextModel';

export type LinkTextFieldSpec = {
  label: string;
  field: Extract<keyof LinkEditor, 'label' | 'url'>;
  placeholder: string;
  inputMode?: 'url';
  type?: 'url';
};

export const LINK_TEXT_FIELDS = [
  { label: 'Label', field: 'label', placeholder: 'Optional' },
  {
    label: 'Web address',
    field: 'url',
    placeholder: 'https://',
    inputMode: 'url',
    type: 'url',
  },
] satisfies LinkTextFieldSpec[];

export function getLinkTypeLabel(linkType: string): string | null {
  return LINK_TYPE_OPTIONS.find((option) => option.value === linkType)?.label ?? null;
}

/** "Instagram link", or the link's own label when it has one. */
export function getLinkRemoveLabel(row: LinkEditor): string {
  return `${row.label.trim() || getLinkTypeLabel(row.linkType) || 'new'} link`;
}
