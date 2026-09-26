'use client';

import { cloneElement, isValidElement, useId } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

import type { MenuItemFilter, MenuItemStatusFilter } from './menuHierarchyItemDomain';
import type { ReactElement, ReactNode } from 'react';

export const MENU_STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All items' },
  { value: 'attention', label: 'Needs attention' },
  { value: 'sold-out', label: 'Sold out' },
] as const satisfies ReadonlyArray<{ value: MenuItemStatusFilter; label: string }>;

export function MenuFilterField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  const childElement = isValidElement(children)
    ? (children as ReactElement<Record<string, unknown>>)
    : null;
  const labelId = useId();
  const controlId = `${labelId}-control`;
  const controlName = label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const isGroupedContent =
    childElement && typeof childElement.type === 'string' && childElement.type === 'div';
  const labelledChild = childElement
    ? cloneElement(childElement, {
        id: isGroupedContent ? childElement.props.id : (childElement.props.id ?? controlId),
        name: isGroupedContent ? childElement.props.name : (childElement.props.name ?? controlName),
        'aria-labelledby': childElement.props['aria-labelledby'] ?? labelId,
      })
    : children;

  return (
    <div className={cn('space-y-2', className)}>
      <Label
        id={labelId}
        htmlFor={isGroupedContent ? undefined : controlId}
        className="text-sm font-medium text-foreground"
      >
        {label}
      </Label>
      {labelledChild}
    </div>
  );
}

/**
 * Search and status filter for the items of the selected menu. The search input stays mounted
 * while results update, so focus and caret are kept.
 */
export function MenuItemFilterToolbar({
  filter,
  onFilterChange,
}: {
  readonly filter: MenuItemFilter;
  readonly onFilterChange: (filter: MenuItemFilter) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
      <MenuFilterField label="Search items" className="min-w-0 sm:w-72">
        <Input
          type="search"
          value={filter.query}
          placeholder="Name or description"
          className="[@media(pointer:coarse)]:min-h-11"
          onChange={(event) => onFilterChange({ ...filter, query: event.target.value })}
        />
      </MenuFilterField>
      <MenuFilterField label="Show">
        <div role="group" className="flex flex-wrap gap-2">
          {MENU_STATUS_FILTER_OPTIONS.map((option) => {
            const pressed = filter.status === option.value;
            return (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={pressed ? 'secondary' : 'outline'}
                aria-pressed={pressed}
                className={cn(
                  '[@media(pointer:coarse)]:min-h-11',
                  pressed && 'border border-border font-semibold',
                )}
                onClick={() => onFilterChange({ ...filter, status: option.value })}
              >
                {option.label}
              </Button>
            );
          })}
        </div>
      </MenuFilterField>
    </div>
  );
}
