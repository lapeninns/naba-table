"use client";

import React, { useCallback, useEffect, useMemo } from "react";

import { Field } from "@/components/reserve/booking-flow/form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { bookingHelpers, type BookingOption } from "@/components/reserve/helpers";
import { Icon } from "@/components/reserve/icons";
import { track } from "@/lib/analytics";
import { BOOKING_TYPES_UI } from "@/lib/enums";

import type { Action, State, StepAction } from "../booking-flow/state";

interface PlanStepProps {
  state: State;
  dispatch: React.Dispatch<Action>;
  // eslint-disable-next-line no-unused-vars
  onActionsChange: (_actions: StepAction[]) => void;
}

export const PlanStep: React.FC<PlanStepProps> = ({ state, dispatch, onActionsChange }) => {
  const { date, time, party, bookingType, seating, notes } = state.details;

  const serviceSlots = useMemo(() => bookingHelpers.slotsByService(date), [date]);
  const diningSlots = useMemo(() => {
    const combined = [...serviceSlots.lunch, ...serviceSlots.dinner];
    return Array.from(new Set(combined));
  }, [serviceSlots]);
  const slots = useMemo(
    () => (bookingType === "drinks" ? serviceSlots.drinks : diningSlots),
    [bookingType, diningSlots, serviceSlots],
  );

  const slotTypeMap = useMemo(() => {
    const map = new Map<string, BookingOption>();
    serviceSlots.lunch.forEach((slot) => map.set(slot, "lunch"));
    serviceSlots.dinner.forEach((slot) => map.set(slot, "dinner"));
    serviceSlots.drinks.forEach((slot) => {
      if (!map.has(slot)) {
        map.set(slot, "drinks");
      }
    });
    return map;
  }, [serviceSlots]);

  const partyOptions = useMemo(() => Array.from({ length: 12 }, (_, index) => index + 1), []);
  const todayStr = useMemo(() => bookingHelpers.formatForDateInput(new Date()), []);
  const selectedDateObj = useMemo(() => {
    if (!date) return undefined;
    const [y, m, d] = date.split("-").map(Number);
    if (!y || !m || !d) return undefined;
    return new Date(y, (m ?? 1) - 1, d ?? 1);
  }, [date]);
  const [dateOpen, setDateOpen] = React.useState(false);
  const [timeInput, setTimeInput] = React.useState<string>(time ? `${bookingHelpers.normalizeTime(time)}:00` : "");

  const isPastSlot = useCallback(
    (slot: string) => {
      try {
        if (date !== todayStr) return false;
        // slot format HH:MM
        const now = new Date();
        const slotDate = new Date(`${date}T${slot}:00`);
        return slotDate.getTime() <= now.getTime();
      } catch {
        return false;
      }
    },
    [date, todayStr],
  );

  const ensureAlignedBookingType = useCallback(
    (slot: string | undefined) => {
      if (!slot) return;
      const inferred = slotTypeMap.get(slot);
      if (inferred && inferred !== bookingType) {
        dispatch({ type: "SET_FIELD", key: "bookingType", value: inferred });
      }
    },
    [bookingType, dispatch, slotTypeMap],
  );

  const firstAvailableSlot = useCallback(
    (arr: string[]): string | undefined => {
      if (!arr.length) return undefined;
      if (date === todayStr) {
        return arr.find((s) => !isPastSlot(s));
      }
      return arr[0];
    },
    [date, isPastSlot, todayStr],
  );

  const ensureTimeForType = useCallback(
    (targetType: BookingOption) => {
      const candidateSlots = targetType === "drinks" ? serviceSlots.drinks : diningSlots;
      if (!candidateSlots.length) {
        dispatch({ type: "SET_FIELD", key: "time", value: "" });
        return;
      }
      const currentUsable = time && (!isPastSlot(time) || date !== todayStr) && candidateSlots.includes(time);
      const preferredSlot = currentUsable ? time : firstAvailableSlot(candidateSlots);
      if (preferredSlot && time !== preferredSlot) {
        dispatch({ type: "SET_FIELD", key: "time", value: preferredSlot });
        track("select_time", { time: preferredSlot });
      }
    },
    [diningSlots, dispatch, firstAvailableSlot, isPastSlot, serviceSlots.drinks, time, date, todayStr],
  );

  useEffect(() => {
    if (!slots.length) {
      if (time) {
        dispatch({ type: "SET_FIELD", key: "time", value: "" });
      }
      return;
    }

    const currentValid = time && slots.includes(time) && !(date === todayStr && isPastSlot(time));
    if (!currentValid) {
      const nextSlot = firstAvailableSlot(slots);
      ensureAlignedBookingType(nextSlot);
      if (time !== nextSlot && nextSlot) {
        dispatch({ type: "SET_FIELD", key: "time", value: nextSlot });
      }
      return;
    }

    if (bookingType !== "drinks") {
      ensureAlignedBookingType(time);
    }
  }, [bookingType, date, dispatch, ensureAlignedBookingType, firstAvailableSlot, isPastSlot, slots, time, todayStr]);

  const handleSlotSelect = (slot: string) => {
    if (!slot) return;
    ensureAlignedBookingType(slot);
    if (slot !== time) {
      dispatch({ type: "SET_FIELD", key: "time", value: slot });
      track("select_time", { time: slot });
    }
  };

  const handleContinue = useCallback(() => {
    if (!date || !time || party <= 0) return;
    dispatch({ type: "SET_STEP", step: 2 });
  }, [date, time, party, dispatch]);

  const handleDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextDate = event.target.value;
    dispatch({ type: "SET_FIELD", key: "date", value: nextDate });
    if (nextDate) {
      track("select_date", { date: nextDate });
    }
  };

  const findNearestSlot = useCallback(
    (hhmm: string): string | undefined => {
      if (!hhmm || !slots.length) return undefined;
      const targetMinutes = bookingHelpers.timeToMinutes(hhmm);
      let best: { slot: string; diff: number } | undefined;
      for (const s of slots) {
        if (date === todayStr && isPastSlot(s)) continue;
        const diff = Math.abs(bookingHelpers.timeToMinutes(s) - targetMinutes);
        if (!best || diff < best.diff) best = { slot: s, diff };
      }
      return best?.slot;
    },
    [slots, date, todayStr, isPastSlot],
  );

  const handleTimeInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value || ""; // HH:MM or HH:MM:SS
    setTimeInput(raw);
    const hhmm = raw.slice(0, 5);
    const nearest = findNearestSlot(hhmm);
    if (nearest) {
      handleSlotSelect(nearest);
    }
  };

  useEffect(() => {
    setTimeInput(time ? `${bookingHelpers.normalizeTime(time)}:00` : "");
  }, [time]);

  const handlePartySelect = (nextParty: number) => {
    if (party === nextParty) return;
    dispatch({ type: "SET_FIELD", key: "party", value: nextParty });
    track("select_party", { party: nextParty });
  };

  const handleBookingTypeSelect = (nextType: BookingOption) => {
    if (nextType === bookingType) return;
    dispatch({ type: "SET_FIELD", key: "bookingType", value: nextType });
    ensureTimeForType(nextType);
  };

  const canContinue = Boolean(date && time && party > 0);

  useEffect(() => {
    const actions: StepAction[] = [
      {
        id: "plan-continue",
        label: "Continue",
        icon: "Check",
        variant: "default",
        disabled: !canContinue,
        onClick: handleContinue,
      },
    ];
    onActionsChange(actions);
  }, [canContinue, handleContinue, onActionsChange]);

  return (
    <Card className="mx-auto w-full max-w-4xl lg:max-w-5xl">
      <CardHeader className="space-y-4">
        <CardTitle className="text-[clamp(1.75rem,1.4rem+0.8vw,2.25rem)] text-srx-ink-strong">
          {state.editingId ? "Modify booking details" : "Plan your visit"}
        </CardTitle>
        <CardDescription className="text-body-sm text-srx-ink-soft">
          Select a date, time, and group size to see available slots.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 md:space-y-8">
        <div className="flex flex-wrap gap-4">
          <div className="flex flex-col gap-3">
            <Label htmlFor="date-picker" className="px-1">Date</Label>
            <Popover open={dateOpen} onOpenChange={setDateOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  id="date-picker"
                  className="h-11 w-40 justify-between rounded-full px-4 font-normal"
                >
                  {selectedDateObj ? selectedDateObj.toLocaleDateString("en-GB") : "Select date"}
                  <Icon.ChevronDown className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDateObj}
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
            <Label htmlFor="time-picker" className="px-1">Time</Label>
            <Input
              type="time"
              id="time-picker"
              step="1"
              value={timeInput}
              onChange={handleTimeInputChange}
              className="appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2 font-medium">
            <Icon.Clock className="h-4 w-4" /> Time
          </Label>
          <p className="text-helper text-srx-ink-soft">Swipe or scroll horizontally to see more times.</p>
          <div className="flex snap-x gap-3 overflow-x-auto pb-3 [-ms-overflow-style:'none'] [scrollbar-width:'none'] [&::-webkit-scrollbar]:hidden">
            {slots.length === 0 && (
              <span className="text-body-sm text-srx-ink-soft">No availability for this selection.</span>
            )}
            {slots.map((slot) => (
              <Button
                key={slot}
                variant={time === slot ? "default" : "outline"}
                className="min-w-[96px] justify-center rounded-full px-5"
                onClick={() => !isPastSlot(slot) && handleSlotSelect(slot)}
                disabled={isPastSlot(slot)}
                aria-disabled={isPastSlot(slot)}
                title={isPastSlot(slot) ? "Past time" : undefined}
              >
                {bookingHelpers.formatTime(slot)}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="font-medium">Guests</Label>
          <div className="flex snap-x gap-3 overflow-x-auto pb-3 [-ms-overflow-style:'none'] [scrollbar-width:'none'] [&::-webkit-scrollbar]:hidden">
            {partyOptions.map((option) => (
              <Button
                key={option}
                variant={party === option ? "default" : "outline"}
                className="min-w-[64px] justify-center rounded-full px-5"
                onClick={() => handlePartySelect(option)}
              >
                {option}
              </Button>
            ))}
            <div className="flex items-center gap-2 rounded-full border border-srx-border-strong bg-white/90 px-3 py-1.5">
              <Label htmlFor="custom-guests" className="text-helper text-srx-ink-soft">
                Custom
              </Label>
              <Input
                id="custom-guests"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                className="h-11 w-24 rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 text-center"
                value={Math.max(1, party)}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (Number.isNaN(val)) return;
                  const clamped = Math.max(1, val);
                  dispatch({ type: "SET_FIELD", key: "party", value: clamped });
                  track("select_party", { party: clamped });
                }}
              />
            </div>
          </div>
        </div>

        <details className="group rounded-xl border border-srx-border-subtle bg-white/90 p-5 shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between text-body-sm font-medium text-srx-ink-strong">
            Additional preferences
            <Icon.ChevronDown className="h-5 w-5 transition group-open:rotate-180" />
          </summary>
          <div className="mt-4 space-y-6">
            <Field id="service" label="Service">
              <div className="flex flex-wrap gap-2">
                {BOOKING_TYPES_UI.map((option) => (
                  <Button
                    key={option}
                    variant={bookingType === option ? "default" : "outline"}
                    size="sm"
                    className="rounded-full"
                    onClick={() => handleBookingTypeSelect(option)}
                  >
                    {bookingHelpers.formatBookingLabel(option)}
                  </Button>
                ))}
              </div>
              <p className="mt-2 text-helper text-srx-ink-soft">
                Drinks reservations show bar availability; lunch and dinner align to table service.
              </p>
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
