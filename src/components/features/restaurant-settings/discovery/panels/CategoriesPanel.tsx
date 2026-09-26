'use client';

import { Plus, X } from 'lucide-react';
import { memo, useState, type KeyboardEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/typography';
import { cn } from '@/lib/utils';

import { getCategoryRowTitle } from './categoriesPanelDomain';
import { CategoryRow } from './CategoryRow';
import {
  DiscoveryDisclosure,
  DiscoveryFieldError,
  useDiscoveryFieldIssue,
  useDiscoveryForm,
} from '../DiscoveryFormContext';
import { DISCOVERY_DISCLOSURE_IDS, DISCOVERY_FIELD_IDS } from '../discoveryValidation';

import type { RestaurantBusinessContextEditor } from '../../useRestaurantBusinessContextEditor';

export const DISCOVERY_CHIP_CLASS =
  'inline-flex min-h-8 max-w-full items-center gap-1 rounded-md border border-border bg-background py-0.5 pl-2.5 pr-0.5 text-sm [@media(pointer:coarse)]:min-h-11';

export const DISCOVERY_CHIP_BUTTON_CLASS =
  'size-7 shrink-0 text-muted-foreground hover:text-foreground [@media(pointer:coarse)]:size-10';

export type CategoriesPanelEditor = Pick<
  RestaurantBusinessContextEditor,
  | 'categories'
  | 'addCategory'
  | 'updateCategory'
  | 'makeCategoryPrimary'
  | 'removeCategory'
  | 'updateMoreHoursDraft'
  | 'addMoreHoursTypes'
  | 'removeMoreHoursType'
>;

/** Section 2: category chips with one main category; codes and hours types under Advanced. */
export const CategoriesPanel = memo(function CategoriesPanel({
  editor,
}: {
  editor: CategoriesPanelEditor;
}) {
  const { requestFocus } = useDiscoveryForm();
  const [newCategory, setNewCategory] = useState('');
  const primaryCount = editor.categories.filter((row) => row.isPrimary).length;
  const firstPrimary = editor.categories.find((row) => row.isPrimary);
  const makeMainIssueId = firstPrimary
    ? DISCOVERY_FIELD_IDS.categoryMakeMain(firstPrimary.id)
    : null;
  const makeMainIssue = useDiscoveryFieldIssue(makeMainIssueId);

  const addCategory = () => {
    if (editor.addCategory(newCategory)) {
      setNewCategory('');
    }
    requestFocus(DISCOVERY_FIELD_IDS.newCategory);
  };

  return (
    <>
      {editor.categories.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Categories">
          {editor.categories.map((row) => {
            const title = getCategoryRowTitle(row);
            const showMakeMain = !row.isPrimary || primaryCount > 1;
            return (
              <li
                key={row.id}
                className={cn(
                  DISCOVERY_CHIP_CLASS,
                  row.isPrimary && 'border-foreground font-medium',
                )}
              >
                <span className="min-w-0 truncate">
                  {title}
                  {row.isPrimary ? <span className="text-muted-foreground"> · main</span> : null}
                </span>
                {showMakeMain ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    id={DISCOVERY_FIELD_IDS.categoryMakeMain(row.id)}
                    aria-label={`Make main: ${title}`}
                    className="h-7 px-2 text-xs [@media(pointer:coarse)]:h-10"
                    onClick={() => {
                      editor.makeCategoryPrimary(row.id);
                      requestFocus(DISCOVERY_FIELD_IDS.newCategory);
                    }}
                  >
                    Make main
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className={DISCOVERY_CHIP_BUTTON_CLASS}
                  aria-label={`Remove ${title}`}
                  onClick={() => {
                    editor.removeCategory(row.id);
                    requestFocus(DISCOVERY_FIELD_IDS.newCategory);
                  }}
                >
                  <X className="size-3.5" aria-hidden />
                </Button>
              </li>
            );
          })}
        </ul>
      ) : (
        <Text variant="caption">No categories yet.</Text>
      )}
      {makeMainIssueId ? (
        <DiscoveryFieldError fieldId={makeMainIssueId} issue={makeMainIssue} />
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Label htmlFor={DISCOVERY_FIELD_IDS.newCategory} className="sr-only">
          New category
        </Label>
        <Input
          id={DISCOVERY_FIELD_IDS.newCategory}
          value={newCategory}
          placeholder="Add a category, e.g. Seafood restaurant"
          className="min-w-0 flex-[1_1_12rem] [@media(pointer:coarse)]:min-h-11"
          onChange={(event) => setNewCategory(event.target.value)}
          onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              addCategory();
            }
          }}
        />
        <Button type="button" variant="outline" onClick={addCategory}>
          <Plus data-icon="inline-start" aria-hidden />
          Add
        </Button>
      </div>

      {editor.categories.length > 0 ? (
        <DiscoveryDisclosure
          id={DISCOVERY_DISCLOSURE_IDS.categoryAdvanced}
          title="Category codes and extra hours types"
          hint="Advanced"
        >
          <div className="flex flex-col gap-3">
            {editor.categories.map((row) => (
              <CategoryRow key={row.id} row={row} editor={editor} />
            ))}
          </div>
        </DiscoveryDisclosure>
      ) : null}
    </>
  );
});
