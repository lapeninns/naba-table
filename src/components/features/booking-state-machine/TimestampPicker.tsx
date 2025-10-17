"use client";

import { useEffect, useMemo, useState } from "react";
import { format, isAfter, isBefore, isValid, parseISO } from "date-fns";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type TimestampValue = string | Date | null;

export type TimestampPickerProps = {
  label?: string;
  value: TimestampValue;
  onChange: (value: string | null) => void;
  minDate?: TimestampValue;
  maxDate?: TimestampValue;
  required?: boolean;
  showRelativeTime?: boolean;
  timezone?: string;
  presets?: Array<{ label: string; getValue: () => Date }>;
  className?: string;
};

function toDate(value?: TimestampValue): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isValid(value) ? value : null;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

function formatDisplay(date: Date | null, timezone?: string): string {
  if (!date) return "Select time";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timezone,
    }).format(date);
  } catch (error) {
    return format(date, "PP p");
  }
}

const DEFAULT_PRESETS: TimestampPickerProps["presets"] = [
  { label: "Now", getValue: () => new Date() },
  { label: "1 hour ago", getValue: () => new Date(Date.now() - 60 * 60 * 1000) },
  { label: "Start of shift", getValue: () => {
    const now = new Date();
    now.setHours(9, 0, 0, 0);
    return now;
  }},
];

export function TimestampPicker({
  label,
  value,
  onChange,
  minDate,
  maxDate,
  required = false,
  showRelativeTime = false,
  timezone,
  presets = DEFAULT_PRESETS,
  className,
}: TimestampPickerProps) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => toDate(value), [value]);
  const [draftDate, setDraftDate] = useState<Date | undefined>(selected ?? undefined);
  const [timeInput, setTimeInput] = useState<string>(selected ? format(selected, "HH:mm") : "12:00");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selected) return;
    setDraftDate(selected);
    setTimeInput(format(selected, "HH:mm"));
  }, [selected]);

  const min = useMemo(() => toDate(minDate), [minDate]);
  const max = useMemo(() => toDate(maxDate), [maxDate]);

  const relativeLabel = useMemo(() => {
    if (!showRelativeTime || !selected) return null;
    const diff = Date.now() - selected.getTime();
    const minutes = Math.round(diff / 60000);
    if (Math.abs(minutes) < 1) return "Just now";
    const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
    if (Math.abs(minutes) < 60) {
      return formatter.format(-minutes, "minute");
    }
    const hours = Math.round(minutes / 60);
    if (Math.abs(hours) < 24) {
      return formatter.format(-hours, "hour");
    }
    const days = Math.round(hours / 24);
    return formatter.format(-days, "day");
  }, [selected, showRelativeTime]);

  const applySelection = (date: Date | null) => {
    if (!date) {
      if (required) {
        setError("Timestamp is required.");
        return;
      }
      onChange(null);
      setOpen(false);
      setError(null);
      return;
    }

    const target = new Date(date);
    const [hours, minutes] = timeInput.split(":").map((value) => Number.parseInt(value, 10));
    if (!Number.isNaN(hours) && !Number.isNaN(minutes)) {
      target.setHours(hours, minutes, 0, 0);
    }

    if (min && isBefore(target, min)) {
      setError(
        `Time must be after ${formatDisplay(min, timezone)}.`,
      );
      return;
    }
    if (max && isAfter(target, max)) {
      setError(
        `Time must be before ${formatDisplay(max, timezone)}.`,
      );
      return;
    }
    setError(null);
    onChange(target.toISOString());
    setOpen(false);
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {label ? <span className="text-xs font-medium text-muted-foreground">{label}</span> : null}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn("justify-between", !selected && "text-muted-foreground")}
          >
            <span>{formatDisplay(selected, timezone)}</span>
            {relativeLabel ? <span className="text-xs text-muted-foreground/80">{relativeLabel}</span> : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] space-y-3 p-4" align="start">
          <Calendar
            mode="single"
            selected={draftDate}
            onSelect={(date) => setDraftDate(date ?? undefined)}
            disabled={(date) => {
              if (min && isBefore(date, min)) return true;
              if (max && isAfter(date, max)) return true;
              return false;
            }}
          />
          <div className="flex items-center gap-2">
            <label htmlFor="timestamp-picker-time" className="text-xs font-medium text-muted-foreground">
              Time
            </label>
            <Input
              id="timestamp-picker-time"
              type="time"
              value={timeInput}
              onChange={(event) => setTimeInput(event.target.value)}
              className="h-9"
            />
          </div>
          {presets && presets.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {presets.map((preset) => (
                <Button
                  key={preset.label}
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const presetDate = preset.getValue();
                    setDraftDate(presetDate);
                    setTimeInput(format(presetDate, "HH:mm"));
                  }}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          ) : null}
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => applySelection(draftDate ?? null)}
            >
              Apply
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
