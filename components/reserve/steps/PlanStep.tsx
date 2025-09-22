"use client";

import React, { useCallback, useEffect, useMemo } from "react";

import { Field } from "@/components/reserve/booking-flow/form";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Textarea,
} from "@/components/reserve/ui-primitives";
import { bookingHelpers, type BookingOption } from "@/components/reserve/helpers";
import { Icon } from "@/components/reserve/icons";
import { track } from "@/lib/analytics";

import type { Action, State } from "../booking-flow/state";

interface PlanStepProps {
  state: State;
  dispatch: React.Dispatch<Action>;
}

export const PlanStep: React.FC<PlanStepProps> = ({ state, dispatch }) => {
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

  const ensureTimeForType = useCallback(
    (targetType: BookingOption) => {
      const candidateSlots = targetType === "drinks" ? serviceSlots.drinks : diningSlots;
      if (!candidateSlots.length) {
        dispatch({ type: "SET_FIELD", key: "time", value: "" });
        return;
      }
      const preferredSlot = candidateSlots.includes(time) ? time : candidateSlots[0];
      if (preferredSlot && time !== preferredSlot) {
        dispatch({ type: "SET_FIELD", key: "time", value: preferredSlot });
        track("select_time", { time: preferredSlot });
      }
    },
    [diningSlots, dispatch, serviceSlots.drinks, time],
  );

  useEffect(() => {
    if (!slots.length) {
      if (time) {
        dispatch({ type: "SET_FIELD", key: "time", value: "" });
      }
      return;
    }

    if (!time || !slots.includes(time)) {
      const nextSlot = slots[0];
      ensureAlignedBookingType(nextSlot);
      if (time !== nextSlot && nextSlot) {
        dispatch({ type: "SET_FIELD", key: "time", value: nextSlot });
      }
      return;
    }

    if (bookingType !== "drinks") {
      ensureAlignedBookingType(time);
    }
  }, [bookingType, dispatch, ensureAlignedBookingType, slots, time]);

  const handleSlotSelect = (slot: string) => {
    if (!slot) return;
    ensureAlignedBookingType(slot);
    if (slot !== time) {
      dispatch({ type: "SET_FIELD", key: "time", value: slot });
      track("select_time", { time: slot });
    }
  };

  const handleDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextDate = event.target.value;
    dispatch({ type: "SET_FIELD", key: "date", value: nextDate });
    if (nextDate) {
      track("select_date", { date: nextDate });
    }
  };

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

  return (
    <Card className="mx-auto w-full max-w-3xl">
      <CardHeader className="space-y-3">
        <CardTitle className="text-2xl">
          {state.editingId ? "Modify booking details" : "Plan your visit"}
        </CardTitle>
        <CardDescription className="text-sm text-slate-600">
          Select a date, time, and group size to see available slots.
        </CardDescription>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          <span className="font-medium text-slate-900">Next step:</span> Choose a time to continue.
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <Field id="date" label="Date" required>
          <Input
            type="date"
            id="date"
            value={date}
            min={bookingHelpers.formatForDateInput(new Date())}
            onChange={handleDateChange}
          />
        </Field>

        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-sm font-medium text-slate-900">
            <Icon.Clock className="h-4 w-4" /> Time
          </Label>
          <p className="text-xs text-slate-500">Scroll horizontally to see more times.</p>
          <div className="flex snap-x gap-2 overflow-x-auto pb-2">
            {slots.length === 0 && (
              <span className="text-sm text-slate-500">No availability for this selection.</span>
            )}
            {slots.map((slot) => (
              <Button
                key={slot}
                variant={time === slot ? "default" : "outline"}
                className="min-w-[88px] justify-center rounded-full"
                onClick={() => handleSlotSelect(slot)}
              >
                {bookingHelpers.formatTime(slot)}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium text-slate-900">Guests</Label>
          <div className="flex snap-x gap-2 overflow-x-auto pb-2">
            {partyOptions.map((option) => (
              <Button
                key={option}
                variant={party === option ? "default" : "outline"}
                className="min-w-[64px] justify-center rounded-full"
                onClick={() => handlePartySelect(option)}
              >
                {option}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium text-slate-900">Service</Label>
          <div className="flex flex-wrap gap-2">
            {["lunch", "dinner", "drinks"].map((option) => (
              <Button
                key={option}
                variant={bookingType === option ? "default" : "outline"}
                size="sm"
                className="rounded-full"
                onClick={() => handleBookingTypeSelect(option as BookingOption)}
              >
                {bookingHelpers.formatBookingLabel(option as BookingOption)}
              </Button>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            Drinks reservations show bar availability; lunch and dinner align to table service.
          </p>
        </div>

        <details className="group rounded-lg border border-slate-200 bg-slate-50 p-4">
          <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-slate-900">
            Additional preferences
            <Icon.ChevronDown className="h-5 w-5 transition group-open:rotate-180" />
          </summary>
          <div className="mt-4 space-y-6">
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
      <CardFooter className="sticky bottom-0 left-0 right-0 -mx-1 -mb-1 flex justify-end gap-2 border-t border-slate-100 bg-white/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:backdrop-blur">
        <Button onClick={() => dispatch({ type: "SET_STEP", step: 2 })} disabled={!canContinue}>
          Continue
        </Button>
      </CardFooter>
    </Card>
  );
};
