"use client";

import { endOfDay, format, isAfter, isBefore, isValid, parseISO, startOfDay } from "date-fns";
import { useEffect, useId, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type TimestampValue = string | Date | null;

export type TimestampPickerProps = {
  label?: string;
  name?: string;
  id?: string;
  value: TimestampValue;
  onChange: (value: string | null) => void;
  onBlur?: () => void;
  minDate?: TimestampValue;
  maxDate?: TimestampValue;
  required?: boolean;
  showRelativeTime?: boolean;
  timezone?: string;
  presets?: Array<{ label: string; getValue: () => Date }>;
  className?: string;
  description?: string;
  timeLabel?: string;
  cancelLabel?: string;
  applyLabel?: string;
  errorMessage?: string | null;
  disabled?: boolean;
  minuteStep?: number;
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
  } catch {
    return format(date, "PP p");
  }
}

const DEFAULT_PRESETS: TimestampPickerProps["presets"] = [
  { label: "Now", getValue: () => new Date() },
  { label: "1 hour ago", getValue: () => new Date(Date.now() - 60 * 60 * 1000) },
  {
    label: "Start of shift",
    getValue: () => {
      const now = new Date();
      now.setHours(9, 0, 0, 0);
      return now;
    },
  },
];

export function TimestampPicker({
  label,
  name,
  id,
  value,
  onChange,
  onBlur,
  minDate,
  maxDate,
  required = false,
  showRelativeTime = false,
  timezone,
  presets = DEFAULT_PRESETS,
  className,
  description,
  timeLabel = "Time",
  cancelLabel = "Cancel",
  applyLabel = "Apply",
  errorMessage,
  disabled = false,
  minuteStep = 1,
}: TimestampPickerProps) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => toDate(value), [value]);
  const [draftDate, setDraftDate] = useState<Date | undefined>(selected ?? undefined);
  const [timeInput, setTimeInput] = useState<string>(selected ? format(selected, "HH:mm") : "12:00");
  const [internalError, setInternalError] = useState<string | null>(null);
  const effectiveMinuteStep = useMemo(() => {
    const numeric = Number.isFinite(minuteStep) ? Math.floor(minuteStep) : 1;
    return numeric > 0 ? numeric : 1;
  }, [minuteStep]);

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

  const generatedId = useId();
  const controlId = id ?? generatedId;
  const descriptionId = description ? `${controlId}-description` : undefined;
  const errorId = `${controlId}-error`;
  const activeError = internalError ?? errorMessage ?? null;

  const handleClose = (next: boolean) => {
    setOpen(next);
    if (!next) {
      onBlur?.();
    }
  };

  const applySelection = (date: Date | null) => {
    if (!date) {
      if (required) {
        setInternalError("Timestamp is required.");
        onBlur?.();
        return;
      }
      onChange(null);
      handleClose(false);
      setInternalError(null);
      return;
    }

    const target = new Date(date);
    const [hours, minutes] = timeInput.split(":").map((value) => Number.parseInt(value, 10));
    if (!Number.isNaN(hours) && !Number.isNaN(minutes)) {
      target.setHours(hours, minutes, 0, 0);
    }

    if (min && isBefore(target, min)) {
      setInternalError(`Time must be after ${formatDisplay(min, timezone)}.`);
      onBlur?.();
      return;
    }
    if (max && isAfter(target, max)) {
      setInternalError(`Time must be before ${formatDisplay(max, timezone)}.`);
      onBlur?.();
      return;
    }
    if (effectiveMinuteStep > 1) {
      const totalMinutes = target.getHours() * 60 + target.getMinutes();
      if (totalMinutes % effectiveMinuteStep !== 0) {
        setInternalError(`Time must align to ${effectiveMinuteStep}-minute intervals.`);
        onBlur?.();
        return;
      }
    }
    setInternalError(null);
    onChange(target.toISOString());
    handleClose(false);
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {label ? (
        <span className="text-xs font-medium text-muted-foreground" id={`${controlId}-label`}>
          {label}
        </span>
      ) : null}
      {description ? (
        <p id={descriptionId} className="text-xs text-muted-foreground">
          {description}
        </p>
      ) : null}
      <Popover open={open} onOpenChange={handleClose}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn("justify-between", !selected && "text-muted-foreground")}
            id={`${controlId}-trigger`}
            aria-labelledby={label ? `${controlId}-label` : undefined}
            aria-describedby={descriptionId}
            aria-invalid={Boolean(activeError)}
            aria-errormessage={activeError ? errorId : undefined}
            disabled={disabled}
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
            disabled={(day) => {
              if (!day) return false;
              if (min && isBefore(endOfDay(day), min)) return true;
              if (max && isAfter(startOfDay(day), max)) return true;
              return false;
            }}
          />
          <div className="flex items-center gap-2">
            <label htmlFor={`${controlId}-time`} className="text-xs font-medium text-muted-foreground">
              {timeLabel}
            </label>
            <Input
              id={`${controlId}-time`}
              name={name}
              type="time"
              step={effectiveMinuteStep * 60}
              value={timeInput}
              onChange={(event) => setTimeInput(event.target.value)}
              className="h-9"
              disabled={disabled}
              aria-invalid={Boolean(activeError)}
              aria-errormessage={activeError ? errorId : undefined}
              onBlur={() => {
                onBlur?.();
              }}
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
                  disabled={disabled}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          ) : null}
          {activeError ? <p className="text-xs text-destructive">{activeError}</p> : null}
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                handleClose(false);
                setInternalError(null);
              }}
              disabled={disabled}
            >
              {cancelLabel}
            </Button>
            <Button
              type="button"
              onClick={() => applySelection(draftDate ?? null)}
              disabled={disabled}
            >
              {applyLabel}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      {!open && activeError ? (
        <p className="text-xs text-destructive" id={errorId}>
          {activeError}
        </p>
      ) : null}
    </div>
  );
}
