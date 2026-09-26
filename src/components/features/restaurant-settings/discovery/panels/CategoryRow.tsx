'use client';

import { Plus, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/typography';

import {
  CATEGORY_TEXT_FIELDS,
  getCategoryRowTitle,
  getMoreHoursTypeDisplayState,
} from './categoriesPanelDomain';
import { makeFieldId, type CategoryEditor } from '../../businessContextModel';
import { DiscoveryFieldError, useDiscoveryField } from '../DiscoveryFormContext';

import type { RestaurantBusinessContextEditor } from '../../useRestaurantBusinessContextEditor';
import type { KeyboardEvent } from 'react';

type CategoryRowEditor = Pick<
  RestaurantBusinessContextEditor,
  'updateCategory' | 'updateMoreHoursDraft' | 'addMoreHoursTypes' | 'removeMoreHoursType'
>;

function CategoryTextField({
  row,
  editor,
  spec,
}: {
  row: CategoryEditor;
  editor: CategoryRowEditor;
  spec: (typeof CATEGORY_TEXT_FIELDS)[number];
}) {
  const fieldId = makeFieldId('categories', row.id, spec.field);
  const helpId = 'helpText' in spec ? `${fieldId}-help` : undefined;
  const { issue, fieldProps } = useDiscoveryField(fieldId, helpId);

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Label htmlFor={fieldId}>{spec.label}</Label>
      <Input
        {...fieldProps}
        value={row[spec.field]}
        placeholder={spec.placeholder}
        className={spec.field === 'categoryCode' ? 'font-mono' : undefined}
        onChange={(event) => editor.updateCategory(row.id, spec.field, event.target.value)}
      />
      {'helpText' in spec ? (
        <Text variant="caption" id={helpId}>
          {spec.helpText}
        </Text>
      ) : null}
      <DiscoveryFieldError fieldId={fieldId} issue={issue} />
    </div>
  );
}

/** Advanced details of one category: name, code and extra hours types. */
export function CategoryRow({ row, editor }: { row: CategoryEditor; editor: CategoryRowEditor }) {
  const title = getCategoryRowTitle(row);
  const hoursFieldId = makeFieldId('categories', row.id, 'moreHoursTypeDraft');

  return (
    <fieldset className="flex min-w-0 flex-col gap-3 rounded-lg border border-border/60 p-3">
      <legend className="px-1 text-sm font-semibold text-foreground">{title}</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {CATEGORY_TEXT_FIELDS.map((spec) => (
          <CategoryTextField key={spec.field} row={row} editor={editor} spec={spec} />
        ))}
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <Label htmlFor={hoursFieldId}>More-hours types</Label>
        {row.moreHoursTypes.length > 0 ? (
          <ul className="flex flex-wrap gap-2" aria-label={`More-hours types for ${title}`}>
            {row.moreHoursTypes.map((moreHoursType, typeIndex) => {
              const display = getMoreHoursTypeDisplayState(moreHoursType);
              return (
                <li key={`${display.label || 'more-hours-type'}-${typeIndex}`}>
                  <Badge variant="secondary" className="gap-1 py-0.5 pl-2 pr-0.5 font-mono">
                    <span>{display.badgeText}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${display.removeLabel}`}
                      className="size-6 text-muted-foreground hover:text-foreground [@media(pointer:coarse)]:size-10"
                      onClick={() => editor.removeMoreHoursType(row.id, typeIndex)}
                    >
                      <X className="size-3" aria-hidden />
                    </Button>
                  </Badge>
                </li>
              );
            })}
          </ul>
        ) : (
          <Text variant="caption">No extra hours types for this category.</Text>
        )}
        <div className="flex flex-wrap gap-2">
          <Input
            id={hoursFieldId}
            value={row.moreHoursTypeDraft}
            placeholder="Add a type, then press Enter"
            className="min-w-0 flex-[1_1_12rem] font-mono [@media(pointer:coarse)]:min-h-11"
            onChange={(event) => {
              const nextValue = event.target.value;
              if (nextValue.includes(',')) {
                editor.addMoreHoursTypes(row.id, nextValue);
                return;
              }
              editor.updateMoreHoursDraft(row.id, nextValue);
            }}
            onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
              if (event.key === 'Enter' || event.key === ',') {
                event.preventDefault();
                editor.addMoreHoursTypes(row.id, event.currentTarget.value);
              }
            }}
            onBlur={() => editor.addMoreHoursTypes(row.id, row.moreHoursTypeDraft)}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => editor.addMoreHoursTypes(row.id, row.moreHoursTypeDraft)}
          >
            <Plus data-icon="inline-start" aria-hidden />
            Add type
          </Button>
        </div>
        <Text variant="caption">
          Labels such as kitchen hours or happy hour, when this category has related hours.
        </Text>
      </div>
    </fieldset>
  );
}
