"use client";

import { X } from "lucide-react";
import { useMemo, useRef } from "react";

import { BOOKING_STATUS_CONFIG } from "@/components/features/booking-state-machine/BookingStatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import type { OpsBookingStatus } from "@/types/ops";

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
};

const STATUS_ORDER: OpsBookingStatus[] = [
  "confirmed",
  "checked_in",
  "completed",
  "pending",
  "pending_allocation",
  "no_show",
  "cancelled",
];

export function OpsStatusFilter({ options, selected, onToggle, onClear, isLoading = false }: OpsStatusFilterProps) {
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const orderedOptions = useMemo(() => {
    const lookup = new Map(options.map((option) => [option.status, option.count] as const));
    return STATUS_ORDER.map((status) => ({
      status,
      count: lookup.get(status) ?? 0,
    }));
  }, [options]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  buttonRefs.current = buttonRefs.current.slice(0, orderedOptions.length);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number, status: OpsBookingStatus) => {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      onToggle(status);
      return;
    }

    const refs = buttonRefs.current;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const next = (index + 1) % refs.length;
      refs[next]?.focus();
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      const prev = (index - 1 + refs.length) % refs.length;
      refs[prev]?.focus();
    }
  };

  const selectedLabel = selected.length > 0 ? `${selected.length} selected` : "All statuses";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" className="h-9 gap-2">
              <span>Status: {selectedLabel}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 space-y-3 p-3" align="start">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Filter by status</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={onClear}
                disabled={selected.length === 0}
              >
                Clear
              </Button>
            </div>
            <div className="flex flex-col gap-1" role="menu" aria-label="Booking status filters">
              {orderedOptions.map((option, index) => {
                const config = BOOKING_STATUS_CONFIG[option.status];
                const isSelected = selectedSet.has(option.status);
                return (
                  <button
                    key={option.status}
                    type="button"
                    ref={(element) => {
                      buttonRefs.current[index] = element;
                    }}
                    role="menuitemcheckbox"
                    aria-checked={isSelected}
                    className={cn(
                      'flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                      isSelected ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-background text-foreground',
                    )}
                    onClick={() => onToggle(option.status)}
                    onKeyDown={(event) => handleKeyDown(event, index, option.status)}
                    disabled={isLoading}
                  >
                    <span className="flex flex-col gap-0.5">
                      <span className="font-medium">{config.label}</span>
                      <span className="text-xs text-muted-foreground">{config.description}</span>
                    </span>
                    <Badge variant={isSelected ? 'default' : 'secondary'}>{option.count}</Badge>
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
        {selected.length > 0 ? (
          <Button type="button" variant="ghost" size="sm" className="h-9" onClick={onClear}>
            <X className="mr-1 h-4 w-4" aria-hidden />
            Clear filters
          </Button>
        ) : null}
      </div>

      {selected.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {selected.map((status) => {
            const config = BOOKING_STATUS_CONFIG[status];
            return (
              <Badge
                key={status}
                variant="outline"
                className="flex items-center gap-1.5 border-primary/40 bg-primary/5 text-primary"
              >
                <span>{config.label}</span>
                <button
                  type="button"
                  className="rounded-full p-0.5 text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  onClick={() => onToggle(status)}
                  aria-label={`Remove ${config.label} filter`}
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </Badge>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
