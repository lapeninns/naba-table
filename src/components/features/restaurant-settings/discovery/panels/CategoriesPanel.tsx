'use client';

import { Plus, Trash2, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

import {
  formatCategoryTitle,
  formatMoreHoursTypeLabel,
  makeFieldId,
  type FamilyKey,
} from '../../businessContextModel';
import { FamilyActions, FamilyError, FamilyStatus } from '../DiscoveryPanelChrome';
import { DiscoveryFamilyPanel } from './DiscoveryFamilyPanel';

import type { RestaurantBusinessContextEditor } from '../../useRestaurantBusinessContextEditor';
import type { KeyboardEvent } from 'react';

export function CategoriesPanel({
  editor,
}: {
  embedded: boolean;
  editor: RestaurantBusinessContextEditor;
  family?: FamilyKey;
}) {
  return (
    <DiscoveryFamilyPanel>
      <FamilyStatus family="categories" editor={editor} />

      {editor.categories.map((row) => (
        <div key={row.id} className="flex flex-col gap-4 rounded-lg border border-border/60 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-semibold text-foreground">
                  {formatCategoryTitle(row)}
                </p>
                {row.isPrimary ? <Badge variant="secondary">Primary</Badge> : null}
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove ${formatCategoryTitle(row)}`}
              title="Remove category"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => editor.removeCategory(row.id)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={makeFieldId('categories', row.id, 'displayName')}>
                Category name
              </Label>
              <Input
                id={makeFieldId('categories', row.id, 'displayName')}
                value={row.displayName}
                placeholder="Restaurant"
                onChange={(event) =>
                  editor.updateCategory(row.id, 'displayName', event.target.value)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={makeFieldId('categories', row.id, 'categoryCode')}>
                Category code
              </Label>
              <Input
                id={makeFieldId('categories', row.id, 'categoryCode')}
                aria-describedby={makeFieldId('categories', row.id, 'categoryCode-help')}
                value={row.categoryCode}
                placeholder="restaurant"
                onChange={(event) =>
                  editor.updateCategory(row.id, 'categoryCode', event.target.value)
                }
              />
              <p
                id={makeFieldId('categories', row.id, 'categoryCode-help')}
                className="text-xs leading-5 text-muted-foreground"
              >
                Optional provider identifier. Leave blank if the category name is enough.
              </p>
            </div>
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
              <p className="text-xs leading-5 text-muted-foreground">
                This is the main category guests and profile providers should see first. Only one
                category can be primary.
              </p>
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
                    const label = formatMoreHoursTypeLabel(moreHoursType);
                    return (
                      <Badge
                        key={`${label || 'more-hours-type'}-${typeIndex}`}
                        variant="secondary"
                        className="gap-1.5 rounded-md py-1 pl-2 pr-1"
                      >
                        <span>{label || 'Unnamed type'}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove ${label || 'more-hours type'}`}
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
                <p className="text-xs leading-5 text-muted-foreground">
                  No extra hours types are listed for this category.
                </p>
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
              <p className="text-xs leading-5 text-muted-foreground">
                Add labels such as kitchen hours or happy hour when this category needs related
                hours.
              </p>
            </div>
          </div>
        </div>
      ))}

      <FamilyActions family="categories" editor={editor} saveLabel="Save categories">
        <Button type="button" variant="outline" onClick={editor.addCategory}>
          <Plus className="size-4" />
          Add category
        </Button>
      </FamilyActions>
      <FamilyError family="categories" editor={editor} />
    </DiscoveryFamilyPanel>
  );
}
