'use client';

import { cloneElement, isValidElement, useId } from 'react';

import type { ReactElement, ReactNode } from 'react';

export const MENU_STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'sold-out', label: 'Sold out' },
  { value: 'available', label: 'Available' },
  { value: 'unavailable', label: 'Unavailable' },
] as const;

export function MenuFilterField({ label, children }: { label: string; children: ReactNode }) {
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
    <div className="space-y-2">
      <label
        id={labelId}
        htmlFor={isGroupedContent ? undefined : controlId}
        className="text-sm font-medium text-foreground"
      >
        {label}
      </label>
      {labelledChild}
    </div>
  );
}
