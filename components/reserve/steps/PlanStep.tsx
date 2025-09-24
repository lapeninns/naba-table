"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

import { Field } from "@/components/reserve/booking-flow/form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { bookingHelpers, type BookingOption } from "@/components/reserve/helpers";
import { Icon } from "@/components/reserve/icons";
import { track } from "@/lib/analytics";

import type { Action, State, StepAction } from "../booking-flow/state";

const RESERVATION_CONFIG = {
  /** Opening time (inclusive) */
  open: "12:00",
  /** Closing time (exclusive) */
  close: "23:00",
  intervalMinutes: 30,
};

const SERVICE_LABELS: Record<BookingOption, string> = {
  lunch: "Lunch",
  dinner: "Dinner",
  drinks: "Drinks & cocktails",
};

const SERVICE_ORDER: BookingOption[] = ["lunch", "dinner", "drinks"];

type ServiceState = "enabled" | "disabled";

type ServiceAvailability = {
  services: Record<BookingOption, ServiceState>;
  labels: {
    happyHour: boolean;
    drinksOnly: boolean;
    kitchenClosed: boolean;
    lunchWindow: boolean;
    dinnerWindow: boolean;
  };
};

type TimeSlot = {
  value: string; // HH:MM
  display: string; // formatted for UI
  label: "Lunch" | "Dinner" | "Happy Hour" | "Drinks only";
};

function timeStringToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function minutesToTimeString(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (totalMinutes % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

function createDateFromParts(date: string, time: string): Date {
  if (!date || !time) return new Date();
  return new Date(`${date}T${time}:00`);
}

function getServiceAvailability(date: string, time: string): ServiceAvailability {
  if (!date || !time) {
    return {
      services: {
        lunch: "disabled",
        dinner: "disabled",
        drinks: "disabled",
      },
      labels: {
        happyHour: false,
        drinksOnly: false,
        kitchenClosed: false,
        lunchWindow: false,
        dinnerWindow: false,
      },
    };
  }

  const openMinutes = timeStringToMinutes(RESERVATION_CONFIG.open);
  const closeMinutes = timeStringToMinutes(RESERVATION_CONFIG.close);
  const slotDate = createDateFromParts(date, time);
  const minutes = slotDate.getHours() * 60 + slotDate.getMinutes();
  const isWeekday = slotDate.getDay() >= 1 && slotDate.getDay() <= 5;

  const isOpen = minutes >= openMinutes && minutes < closeMinutes;
  const inLunchWindow = minutes >= 12 * 60 && minutes < 15 * 60;
  const inDinnerWindow = minutes >= 17 * 60 && minutes < closeMinutes;
  const inHappyHourWindow = isWeekday && minutes >= 15 * 60 && minutes < 17 * 60;

  const baseServices: Record<BookingOption, ServiceState> = {
    drinks: isOpen ? "enabled" : "disabled",
    lunch: "disabled",
    dinner: "disabled",
  };

  if (isOpen && !inHappyHourWindow) {
    if (inLunchWindow) {
      baseServices.lunch = "enabled";
    }
    if (inDinnerWindow) {
      baseServices.dinner = "enabled";
    }
  }

  if (!inLunchWindow) {
    baseServices.lunch = baseServices.lunch === "enabled" ? "enabled" : "disabled";
  }
  if (!inDinnerWindow) {
    baseServices.dinner = baseServices.dinner === "enabled" ? "enabled" : "disabled";
  }

  if (inHappyHourWindow) {
    baseServices.lunch = "disabled";
    baseServices.dinner = "disabled";
  }

  const drinksOnly = baseServices.drinks === "enabled" &&
    baseServices.lunch === "disabled" &&
    baseServices.dinner === "disabled";

  return {
    services: baseServices,
    labels: {
      happyHour: inHappyHourWindow,
      drinksOnly,
      kitchenClosed: inHappyHourWindow,
      lunchWindow: inLunchWindow,
      dinnerWindow: inDinnerWindow,
    },
  };
}

function resolveDefaultService(date: string, time: string): BookingOption {
  const availability = getServiceAvailability(date, time);

  if (availability.labels.happyHour) {
    return "drinks";
  }
  if (availability.services.lunch === "enabled") {
    return "lunch";
  }
  if (availability.services.dinner === "enabled") {
    return "dinner";
  }
  return "drinks";
}

function getSlotLabel(slotDate: Date): TimeSlot["label"] {
  const isWeekday = slotDate.getDay() >= 1 && slotDate.getDay() <= 5;
  const minutes = slotDate.getHours() * 60 + slotDate.getMinutes();
  const inLunchWindow = minutes >= 12 * 60 && minutes < 15 * 60;
  const inDinnerWindow = minutes >= 17 * 60;
  const inHappyHourWindow = isWeekday && minutes >= 15 * 60 && minutes < 17 * 60;

  if (inHappyHourWindow) return "Happy Hour";
  if (inLunchWindow) return "Lunch";
  if (inDinnerWindow) return "Dinner";
  return "Drinks only";
}

function generateTimeSlots(date: string): TimeSlot[] {
  const openMinutes = timeStringToMinutes(RESERVATION_CONFIG.open);
  const closeMinutes = timeStringToMinutes(RESERVATION_CONFIG.close);
  const interval = RESERVATION_CONFIG.intervalMinutes;
  const slots: TimeSlot[] = [];

  if (!date) return slots;

  for (let minutes = openMinutes; minutes < closeMinutes; minutes += interval) {
    const value = minutesToTimeString(minutes);
    const slotDate = createDateFromParts(date, value);
    slots.push({
      value,
      display: bookingHelpers.formatTime(value),
      label: getSlotLabel(slotDate),
    });
  }

  return slots;
}

const SERVICE_TOOLTIP = "Not available for the selected time.";

interface PlanStepProps {
  state: State;
  dispatch: React.Dispatch<Action>;
  // eslint-disable-next-line no-unused-vars
  onActionsChange: (_actions: StepAction[]) => void;
}

export const PlanStep: React.FC<PlanStepProps> = ({ state, dispatch, onActionsChange }) => {
  const { date, time, party, bookingType, seating, notes } = state.details;
  const [dateOpen, setDateOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);

  const timeSlots = useMemo(() => generateTimeSlots(date), [date]);
  const serviceAvailability = useMemo(
    () => getServiceAvailability(date, time),
    [date, time],
  );

  useEffect(() => {
    if (!timeSlots.length) return;
    const normalizedTime = bookingHelpers.normalizeTime(time);
    const hasTime = normalizedTime && timeSlots.some((slot) => slot.value === normalizedTime);
    if (!hasTime) {
      const firstSlot = timeSlots[0]?.value ?? "";
      if (firstSlot) {
        dispatch({ type: "SET_FIELD", key: "time", value: firstSlot });
        const defaultService = resolveDefaultService(date, firstSlot);
        dispatch({ type: "SET_FIELD", key: "bookingType", value: defaultService });
      }
    }
  }, [date, dispatch, timeSlots, time]);

  useEffect(() => {
    const currentState = serviceAvailability.services[bookingType];
    if (currentState === "disabled") {
      const fallback = SERVICE_ORDER.find((option) => serviceAvailability.services[option] === "enabled") || "drinks";
      if (fallback !== bookingType) {
        dispatch({ type: "SET_FIELD", key: "bookingType", value: fallback });
      }
    }
  }, [bookingType, dispatch, serviceAvailability.services]);

  const handleSlotSelect = useCallback(
    (slot: TimeSlot) => {
      if (!slot) return;
      dispatch({ type: "SET_FIELD", key: "time", value: slot.value });
      const defaultService = resolveDefaultService(date, slot.value);
      dispatch({ type: "SET_FIELD", key: "bookingType", value: defaultService });
      track("select_time", { time: slot.value });
    },
    [date, dispatch],
  );

  const handleContinue = useCallback(() => {
    if (!date || !time || party <= 0) return;
    dispatch({ type: "SET_STEP", step: 2 });
  }, [date, time, party, dispatch]);

  const handlePartyAdjust = useCallback((delta: number) => {
    const next = Math.max(1, party + delta);
    if (next === party) return;
    dispatch({ type: "SET_FIELD", key: "party", value: next });
    track("select_party", { party: next });
  }, [dispatch, party]);

  const handleServiceChange = useCallback((next: string) => {
    if (!next) return;
    const serviceKey = next as BookingOption;
    if (serviceAvailability.services[serviceKey] === "disabled") return;
    if (serviceKey !== bookingType) {
      dispatch({ type: "SET_FIELD", key: "bookingType", value: serviceKey });
    }
  }, [bookingType, dispatch, serviceAvailability.services]);

  const canContinue = Boolean(date && time && party > 0);

  useEffect(() => {
    onActionsChange([
      {
        id: "plan-continue",
        label: "Continue",
        icon: "Check",
        variant: "default",
        disabled: !canContinue,
        onClick: handleContinue,
      },
    ]);
  }, [canContinue, handleContinue, onActionsChange]);

  const guestLabel = party === 1 ? "1 person" : `${party} people`;

  const selectedSlotMeta = useMemo(() => {
    if (!time) return null;
    const slotDate = createDateFromParts(date, bookingHelpers.normalizeTime(time));
    return getSlotLabel(slotDate);
  }, [date, time]);

  return (
    <Card className="mx-auto w-full max-w-4xl lg:max-w-5xl">
      <CardHeader className="space-y-4">
        <CardTitle className="text-[clamp(1.75rem,1.45rem+0.6vw,2.2rem)] text-srx-ink-strong">
          {state.editingId ? "Modify booking details" : "Plan your visit"}
        </CardTitle>
        <CardDescription className="text-body-sm text-srx-ink-soft">
          Select a date, time, and group size to see available slots.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-end">
          <div className="flex flex-col gap-3">
            <Label htmlFor="date-picker" className="px-1">Date</Label>
            <Popover open={dateOpen} onOpenChange={setDateOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  id="date-picker"
                  className="h-11 w-full justify-between rounded-full px-4 font-normal"
                >
                  {date ? bookingHelpers.formatSummaryDate(date) : "Select date"}
                  <Icon.ChevronDown className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date ? new Date(`${date}T00:00:00`) : undefined}
                  captionLayout="dropdown"
                  onSelect={(next) => {
                    if (!next) return;
                    const formatted = bookingHelpers.formatForDateInput(next);
                    dispatch({ type: "SET_FIELD", key: "date", value: formatted });
                    track("select_date", { date: formatted });
                    setDateOpen(false);
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex flex-col gap-3">
            <Label className="px-1">Time</Label>
            <Popover open={timeOpen} onOpenChange={setTimeOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full justify-between rounded-full px-4 font-normal"
                >
                  <span className="flex flex-col items-start leading-tight">
                    <span className="text-sm font-semibold text-srx-ink-strong">
                      {time ? bookingHelpers.formatTime(time) : "Select time"}
                    </span>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-srx-ink-soft">
                      {selectedSlotMeta ?? "Choose a slot"}
                    </span>
                  </span>
                  <Icon.ChevronDown className="h-4 w-4" aria-hidden />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                className="w-60 overflow-hidden rounded-xl border border-srx-border-subtle bg-white/95 p-0 shadow-lg"
              >
                <div
                  role="listbox"
                  aria-label="Available reservation times"
                  className="max-h-72 overflow-y-auto py-1"
                >
                  {timeSlots.map((slot) => {
                    const normalizedTime = bookingHelpers.normalizeTime(time);
                    const isSelected = normalizedTime === slot.value;
                    return (
                      <button
                        key={slot.value}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => {
                          handleSlotSelect(slot);
                          setTimeOpen(false);
                        }}
                        className={bookingHelpers.cn(
                          "flex w-full items-center justify-between px-4 py-2 text-left text-sm transition focus:bg-srx-ink-strong/10 focus:outline-none",
                          isSelected
                            ? "bg-srx-ink-strong text-white"
                            : "text-srx-ink-strong hover:bg-srx-ink-strong/5"
                        )}
                      >
                        <span>{slot.display}</span>
                        <span className={bookingHelpers.cn(
                          "ml-4 text-[10px] font-semibold uppercase tracking-[0.16em]",
                          isSelected ? "text-white/80" : "text-srx-ink-soft"
                        )}
                        >
                          {slot.label}
                        </span>
                      </button>
                    );
                  })}
                  {timeSlots.length === 0 && (
                    <div className="px-4 py-3 text-sm text-srx-ink-soft">Select a date to see available times.</div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {selectedSlotMeta === "Happy Hour" && (
          <Badge variant="secondary" className="w-fit uppercase tracking-[0.18em] text-xs">
            Happy Hour
          </Badge>
        )}

        {serviceAvailability.labels.kitchenClosed && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
          >
            <Icon.Info className="mt-0.5 h-4 w-4" />
            <span>
              Kitchen closed from 15:00 to 17:00 on weekdays. Drinks and cocktails are still available.
            </span>
          </div>
        )}

        <section className="space-y-3">
          <Label className="text-base font-semibold">Guests</Label>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-4 rounded-full border border-srx-border-subtle bg-white/95 px-4 py-2">
              <Button
                type="button"
                variant="ghost"
                className="h-8 w-8 rounded-full border border-srx-border-subtle p-0 text-lg leading-none"
                onClick={() => handlePartyAdjust(-1)}
                aria-label="Decrease guest count"
                disabled={party <= 1}
              >
                -
              </Button>
              <span aria-live="polite" className="min-w-[72px] text-center text-sm font-semibold text-srx-ink-strong">
                {guestLabel}
              </span>
              <Button
                type="button"
                variant="ghost"
                className="h-8 w-8 rounded-full border border-srx-border-subtle p-0 text-lg leading-none"
                onClick={() => handlePartyAdjust(1)}
                aria-label="Increase guest count"
              >
                +
              </Button>
            </div>
          </div>
        </section>

        <details className="group rounded-xl border border-srx-border-subtle bg-white/90 p-5 shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between text-body-sm font-medium text-srx-ink-strong">
            Additional preferences
            <Icon.ChevronDown className="h-5 w-5 transition group-open:rotate-180" />
          </summary>
          <div className="mt-4 space-y-6">
            <Field id="service" label="Service">
              <TooltipProvider>
                <ToggleGroup
                  type="single"
                  value={bookingType}
                  onValueChange={handleServiceChange}
                  className="flex flex-wrap gap-2"
                >
                  {SERVICE_ORDER.map((option) => {
                    const disabled = serviceAvailability.services[option] === "disabled";
                    const item = (
                      <ToggleGroupItem
                        key={option}
                        value={option}
                        aria-disabled={disabled}
                        data-disabled={disabled ? "true" : undefined}
                        className="rounded-full px-5 py-2 text-sm font-medium data-[disabled='true']:cursor-not-allowed data-[disabled='true']:opacity-40"
                        onPointerDown={(event) => {
                          if (disabled) {
                            event.preventDefault();
                          }
                        }}
                        onKeyDown={(event) => {
                          if (disabled && (event.key === " " || event.key === "Enter")) {
                            event.preventDefault();
                          }
                        }}
                      >
                        {SERVICE_LABELS[option]}
                      </ToggleGroupItem>
                    );
                    if (!disabled) {
                      return item;
                    }
                    return (
                      <Tooltip key={option} delayDuration={150}>
                        <TooltipTrigger asChild>{item}</TooltipTrigger>
                        <TooltipContent>{SERVICE_TOOLTIP}</TooltipContent>
                      </Tooltip>
                    );
                  })}
                </ToggleGroup>
              </TooltipProvider>
              {serviceAvailability.labels.drinksOnly && !serviceAvailability.labels.happyHour && (
                <p className="mt-2 text-helper text-srx-ink-soft">This time is available for drinks and cocktails only.</p>
              )}
            </Field>
            <Field id="seating" label="Seating preference">
              <div className="flex flex-wrap gap-2">
                {["any", "indoor", "outdoor"].map((option) => (
                  <Button
                    key={option}
                    variant={seating === option ? "default" : "outline"}
                    size="sm"
                    className="rounded-full"
                    onClick={() => dispatch({ type: "SET_FIELD", key: "seating", value: option })}
                  >
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </Button>
                ))}
              </div>
            </Field>
            <Field id="notes" label="Notes (optional)">
              <Textarea
                id="notes"
                value={notes}
                onChange={(event) => dispatch({ type: "SET_FIELD", key: "notes", value: event.target.value })}
                placeholder="e.g., birthday celebration, dietary requirements"
              />
            </Field>
          </div>
        </details>
      </CardContent>
    </Card>
  );
};
