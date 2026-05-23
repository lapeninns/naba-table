import {
  formatCategoryTitle,
  formatMoreHoursTypeLabel,
  type CategoryEditor,
} from '../../businessContextModel';

export type CategoryTextFieldSpec = {
  label: string;
  field: Extract<keyof CategoryEditor, 'displayName' | 'categoryCode'>;
  placeholder: string;
  helpText?: string;
};

export type MoreHoursTypeDisplayState = {
  label: string;
  badgeText: string;
  removeLabel: string;
};

export const CATEGORY_TEXT_FIELDS = [
  { label: 'Category name', field: 'displayName', placeholder: 'Restaurant' },
  {
    label: 'Category code',
    field: 'categoryCode',
    placeholder: 'restaurant',
    helpText: 'Optional provider identifier. Leave blank if the category name is enough.',
  },
] satisfies CategoryTextFieldSpec[];

export function getCategoryRowTitle(row: CategoryEditor): string {
  return formatCategoryTitle(row);
}

export function getMoreHoursTypeDisplayState(
  row: CategoryEditor['moreHoursTypes'][number],
): MoreHoursTypeDisplayState {
  const label = formatMoreHoursTypeLabel(row);

  return {
    label,
    badgeText: label || 'Unnamed type',
    removeLabel: label || 'more-hours type',
  };
}
