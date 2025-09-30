'use client';

import * as React from 'react';
import { DayPicker } from 'react-day-picker';

import { cn } from '@shared/lib/cn';

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={{
        months: 'flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0',
        month: 'space-y-4',
        caption: 'flex justify-center pt-1 relative items-center',
        caption_label: 'text-sm font-medium',
        nav: 'space-x-1 flex items-center',
        nav_button:
          'h-8 w-8 bg-transparent p-0 opacity-50 hover:opacity-100 inline-flex items-center justify-center rounded-md border border-srx-border-subtle',
        nav_button_previous: 'absolute left-1',
        nav_button_next: 'absolute right-1',
        table: 'w-full border-collapse space-y-1',
        head_row: 'flex',
        head_cell:
          'text-muted-foreground rounded-md w-9 font-normal text-[0.8rem] text-srx-ink-soft',
        row: 'flex w-full mt-2',
        cell: cn(
          'relative h-9 w-9 text-center text-sm p-0',
          'focus-within:relative focus-within:z-20',
        ),
        day: cn(
          'h-9 w-9 p-0 font-normal aria-selected:opacity-100 rounded-md',
          'hover:bg-srx-surface-positive-alt',
        ),
        day_selected:
          'bg-[color:var(--color-primary)] text-[color:var(--color-on-primary)] hover:bg-[color:var(--color-primary)]',
        day_today: 'bg-srx-surface-positive text-srx-ink-strong',
        day_outside: 'text-srx-ink-soft opacity-50',
        day_disabled: 'text-srx-ink-soft opacity-50',
        day_range_middle: 'aria-selected:bg-srx-surface-positive',
        day_hidden: 'invisible',
        ...classNames,
      }}
      {...props}
    />
  );
}
