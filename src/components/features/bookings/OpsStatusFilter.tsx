'use client';

import { X } from 'lucide-react';
import { useMemo, useRef } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/typography';
import { OPS_BOOKING_STATUS_ORDER, getOpsBookingStatusUi } from '@/lib/ops/booking-status';
import { cn } from '@/lib/utils';

import type { OpsBookingStatus } from '@/types/ops';

type StatusOption = {
  status: OpsBookingStatus;
  count: number;
};

type OpsStatusFilterProps = {
  options: StatusOption[];
  selected: OpsBookingStatus[];
  onToggle: (status: OpsBookingStatus) => void;
  onClear: () => void;
  isLoading?: boolean;
  order?: OpsBookingStatus[];
};

export function OpsStatusFilter({
  options,
  selected,
  onToggle,
  onClear,
  isLoading = false,
  order,
}: OpsStatusFilterProps) {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const resolvedOrder = order ?? OPS_BOOKING_STATUS_ORDER;

  const orderedOptions = useMemo(() => {
    const lookup = new Map(options.map((option) => [option.status, option.count] as const));
    return resolvedOrder.map((status) => ({
      status,
      count: lookup.get(status) ?? 0,
    }));
  }, [options, resolvedOrder]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  buttonRefs.current = buttonRefs.current.slice(0, orderedOptions.length);

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
    status: OpsBookingStatus,
  ) => {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      onToggle(status);
      return;
    }

    const refs = buttonRefs.current;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const next = (index + 1) % refs.length;
      refs[next]?.focus();
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      const prev = (index - 1 + refs.length) % refs.length;
      refs[prev]?.focus();
    }
  };

  const selectedLabel = selected.length > 0 ? `${selected.length} selected` : 'All statuses';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" className="h-11 gap-2 sm:h-9">
              <span>Status: {selectedLabel}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 space-y-3 p-3" align="start">
            <div className="flex items-center justify-between">
              <Text variant="eyebrow">
                Filter by status
              </Text>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-11 px-3 text-xs sm:h-8 sm:px-2"
                onClick={onClear}
                disabled={selected.length === 0}
              >
                Clear
              </Button>
            </div>
            <div
              className="flex flex-col gap-1"
              role="menu"
              aria-label="Booking status filters"
              aria-busy={isLoading}
            >
              {orderedOptions.map((option, index) => {
                const config = getOpsBookingStatusUi(option.status);
                const isSelected = selectedSet.has(option.status);
                return (
                  <Button
                    key={option.status}
                    type="button"
                    variant="ghost"
                    ref={(element) => {
                      buttonRefs.current[index] = element;
                    }}
                    role="menuitemcheckbox"
                    aria-checked={isSelected}
                    className={cn(
                      'h-auto w-full justify-between whitespace-normal rounded-lg border px-3 py-3 text-left text-sm sm:py-2',
                      isSelected
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border bg-background text-foreground',
                    )}
                    onClick={() => onToggle(option.status)}
                    onKeyDown={(event) => handleKeyDown(event, index, option.status)}
                  >
                    <span className="flex flex-col gap-0.5">
                      <span className="font-medium">{config.label}</span>
                      <span className="text-xs text-muted-foreground">{config.description}</span>
                    </span>
                    {isLoading ? (
                      <Skeleton className="h-5 w-10" aria-hidden />
                    ) : (
                      <Badge variant={isSelected ? 'default' : 'secondary'}>{option.count}</Badge>
                    )}
                  </Button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
        {selected.length > 0 ? (
          <Button type="button" variant="ghost" size="sm" className="h-11 sm:h-9" onClick={onClear}>
            <X className="mr-1 size-4" aria-hidden />
            Clear filters
          </Button>
        ) : null}
      </div>

      {selected.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {selected.map((status) => {
            const config = getOpsBookingStatusUi(status);
            return (
              <Badge
                key={status}
                variant="outline"
                className="flex items-center gap-1.5 border-primary/40 bg-primary/5 text-primary"
              >
                <span>{config.label}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-5 rounded-full p-0 text-primary hover:bg-primary/10"
                  onClick={() => onToggle(status)}
                  aria-label={`Remove ${config.label} filter`}
                >
                  <X aria-hidden />
                </Button>
              </Badge>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
