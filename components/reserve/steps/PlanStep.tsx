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
                onClick={() => handleSlotSelect(slot)}
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
