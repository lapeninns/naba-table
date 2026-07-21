'use client';

import { Plus, Trash2, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/typography';

import {
  CATEGORY_TEXT_FIELDS,
  getCategoryRowTitle,
  getMoreHoursTypeDisplayState,
} from './categoriesPanelDomain';
import { makeFieldId, type CategoryEditor } from '../../businessContextModel';

import type { RestaurantBusinessContextEditor } from '../../useRestaurantBusinessContextEditor';
import type { KeyboardEvent } from 'react';

export function CategoryRow({
  row,
  editor,
}: {
  row: CategoryEditor;
  editor: RestaurantBusinessContextEditor;
}) {
  const rowTitle = getCategoryRowTitle(row);

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-foreground">{rowTitle}</p>
            {row.isPrimary ? <Badge variant="secondary">Primary</Badge> : null}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Remove ${rowTitle}`}
          title="Remove category"
          className="text-muted-foreground hover:text-destructive"
          onClick={() => editor.removeCategory(row.id)}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {CATEGORY_TEXT_FIELDS.map(({ label, field, placeholder, helpText }) => (
          <div key={field} className="space-y-2">
            <Label htmlFor={makeFieldId('categories', row.id, field)}>{label}</Label>
            <Input
              id={makeFieldId('categories', row.id, field)}
              aria-describedby={
                helpText ? makeFieldId('categories', row.id, `${field}-help`) : undefined
              }
              value={row[field]}
              placeholder={placeholder}
              onChange={(event) => editor.updateCategory(row.id, field, event.target.value)}
            />
            {helpText ? (
              <Text
                variant="caption"
                id={makeFieldId('categories', row.id, `${field}-help`)}
              >
                {helpText}
              </Text>
            ) : null}
          </div>
        ))}
      </div>
      <div className="flex items-start gap-3 border-t border-border/60 pt-4">
        <Switch
          id={makeFieldId('categories', row.id, 'isPrimary')}
          aria-labelledby={makeFieldId('categories', row.id, 'isPrimary-label')}
          checked={row.isPrimary}
          onCheckedChange={(checked) => editor.updateCategory(row.id, 'isPrimary', checked)}
        />
        <div className="space-y-1">
          <Label
            id={makeFieldId('categories', row.id, 'isPrimary-label')}
            htmlFor={makeFieldId('categories', row.id, 'isPrimary')}
          >
            Primary category
          </Label>
          <Text variant="caption">
            This is the main category guests and profile providers should see first. Only one
            category can be primary.
          </Text>
        </div>
      </div>
      <div className="space-y-3 border-t border-border/60 pt-4">
        <Label htmlFor={makeFieldId('categories', row.id, 'moreHoursTypeDraft')}>
          More-hours types
        </Label>
        <div className="space-y-2">
          {row.moreHoursTypes.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {row.moreHoursTypes.map((moreHoursType, typeIndex) => {
                const display = getMoreHoursTypeDisplayState(moreHoursType);

                return (
                  <Badge
                    key={`${display.label || 'more-hours-type'}-${typeIndex}`}
                    variant="secondary"
                    className="gap-1.5 rounded-md py-1 pl-2 pr-1"
                  >
                    <span>{display.badgeText}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${display.removeLabel}`}
                      className="size-5 rounded-sm text-muted-foreground hover:bg-background hover:text-foreground"
                      onClick={() => editor.removeMoreHoursType(row.id, typeIndex)}
                    >
                      <X className="size-3" />
                    </Button>
                  </Badge>
                );
              })}
            </div>
          ) : (
            <Text variant="caption">
              No extra hours types are listed for this category.
            </Text>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id={makeFieldId('categories', row.id, 'moreHoursTypeDraft')}
              value={row.moreHoursTypeDraft}
              placeholder="Add a type, then press Enter"
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
              <Plus className="size-4" />
              Add type
            </Button>
          </div>
          <Text variant="caption">
            Add labels such as kitchen hours or happy hour when this category needs related hours.
          </Text>
        </div>
      </div>
    </div>
  );
}
