'use client';

import { Filter } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

import { COMMS_CONTROL_HEIGHT_CLASS } from './communicationsDeliveryClasses';

export type CommunicationsDeliveryStatusFilterProps<TStatus extends string> = {
  options: ReadonlyArray<{ value: TStatus; label: string }>;
  selected: readonly TStatus[];
  counts?: Partial<Record<TStatus, number>> | null;
  onToggle: (status: TStatus, enabled: boolean) => void;
  className?: string;
};

/** Multi-select status filter shared by the Email and Messages filter bars. */
export function CommunicationsDeliveryStatusFilter<TStatus extends string>({
  options,
  selected,
  counts,
  onToggle,
  className,
}: CommunicationsDeliveryStatusFilterProps<TStatus>) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(COMMS_CONTROL_HEIGHT_CLASS, 'w-full justify-start sm:w-auto', className)}
          aria-label={
            selected.length > 0
              ? `Filter by status, ${selected.length} selected`
              : 'Filter by status'
          }
        >
          <Filter data-icon="inline-start" aria-hidden />
          Status
          {selected.length > 0 ? (
            <Badge variant="secondary" className="ml-auto px-1.5 py-0 tabular-nums sm:ml-1">
              {selected.length}
            </Badge>
          ) : (
            <span className="ml-auto text-muted-foreground sm:ml-1">All</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground">Filter by status</p>
        <div className="flex flex-col gap-1">
          {options.map(({ value, label }) => {
            const checked = selected.includes(value);
            const count = counts?.[value];
            return (
              <Label
                key={value}
                className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-1 sm:min-h-8"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(next) => onToggle(value, Boolean(next))}
                  aria-label={label}
                />
                <span className="text-sm">{label}</span>
                {typeof count === 'number' ? (
                  <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                    {count}
                  </span>
                ) : null}
              </Label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
