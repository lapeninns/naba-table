'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { track } from '@/lib/analytics';
import { Icon } from '@reserve/shared/ui/icons';
import { bookingHelpers, type BookingOption } from '@reserve/shared/utils/booking';

import type { Action, State, StepAction } from '../../model/reducer';

const RESERVATION_CONFIG = {
  open: '12:00',
  close: '23:00',
  intervalMinutes: 30,
};

const SERVICE_LABELS: Record<BookingOption, string> = {
  lunch: 'Lunch',
  dinner: 'Dinner',
  drinks: 'Drinks & cocktails',
};

const SERVICE_ORDER: BookingOption[] = ['lunch', 'dinner', 'drinks'];

type ServiceState = 'enabled' | 'disabled';

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
  value: string;
  display: string;
  label: 'Lunch' | 'Dinner' | 'Happy Hour' | 'Drinks only';
};

function timeStringToMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function minutesToTimeString(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60)
    .toString()
    .padStart(2, '0');
  const minutes = (totalMinutes % 60).toString().padStart(2, '0');
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
        lunch: 'disabled',
        dinner: 'disabled',
        drinks: 'disabled',
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
  const isOpen = minutes >= openMinutes && minutes < closeMinutes;
  const windows = bookingHelpers.serviceWindows(date);

  const within = (window: { start: string; end: string } | null | undefined) => {
    if (!window) return false;
    const startMinutes = timeStringToMinutes(window.start);
    const endMinutes = timeStringToMinutes(window.end);
    return minutes >= startMinutes && minutes < endMinutes;
  };

  const baseLunch = isOpen && within(windows.lunch);
  const baseDinner = isOpen && within(windows.dinner);
  const inHappyHourWindow = isOpen && within(windows.happyHour);

  const services: Record<BookingOption, ServiceState> = {
    lunch: baseLunch && !inHappyHourWindow ? 'enabled' : 'disabled',
    dinner: baseDinner && !inHappyHourWindow ? 'enabled' : 'disabled',
    drinks: isOpen ? 'enabled' : 'disabled',
  };

  const drinksOnly =
    services.drinks === 'enabled' &&
    services.lunch === 'disabled' &&
    services.dinner === 'disabled';

  return {
    services,
    labels: {
      happyHour: inHappyHourWindow,
      drinksOnly,
      kitchenClosed: inHappyHourWindow,
      lunchWindow: services.lunch === 'enabled',
      dinnerWindow: services.dinner === 'enabled',
    },
  };
}

function resolveDefaultService(date: string, time: string): BookingOption {
  const availability = getServiceAvailability(date, time);

  if (availability.labels.happyHour) {
    return 'drinks';
  }
  if (availability.services.lunch === 'enabled') {
    return 'lunch';
  }
  if (availability.services.dinner === 'enabled') {
    return 'dinner';
  }
  return 'drinks';
}

function getSlotLabel(slotDate: Date): TimeSlot['label'] {
  const day = slotDate.getDay();
  const isWeekend = day === 0 || day === 6;
  const minutes = slotDate.getHours() * 60 + slotDate.getMinutes();
  const lunchEnd = isWeekend ? 17 * 60 : 15 * 60;
  const inLunchWindow = minutes >= 12 * 60 && minutes < lunchEnd;
  const inHappyHourWindow = !isWeekend && minutes >= 15 * 60 && minutes < 17 * 60;
  const inDinnerWindow = minutes >= 17 * 60;

  if (inHappyHourWindow) return 'Happy Hour';
  if (inLunchWindow) return 'Lunch';
  if (inDinnerWindow) return 'Dinner';
  return 'Drinks only';
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

const SERVICE_TOOLTIP = 'Not available for the selected time.';

interface PlanStepProps {
  state: State;
  dispatch: React.Dispatch<Action>;
  onActionsChange: (actions: StepAction[]) => void;
}

export function PlanStep({ state, dispatch, onActionsChange }: PlanStepProps) {
  const [open, setOpen] = useState(false);
  const [hoveredSlot, setHoveredSlot] = useState<string | null>(null);

  const minSelectableDate = useMemo(() => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    return base;
  }, []);

  const slots = useMemo(() => generateTimeSlots(state.details.date), [state.details.date]);

  const serviceAvailability = useMemo(
    () => getServiceAvailability(state.details.date, state.details.time),
    [state.details.date, state.details.time],
  );

  const handleSelectTime = useCallback(
    (value: string) => {
      dispatch({ type: 'SET_FIELD', key: 'time', value });
      const inferredService = resolveDefaultService(state.details.date, value);
      dispatch({ type: 'SET_FIELD', key: 'bookingType', value: inferredService });
      track('select_time', {
        time: value,
        booking_type: inferredService,
      });
    },
    [dispatch, state.details.date],
  );

  useEffect(() => {
    const actions: StepAction[] = [
      {
        id: 'plan-continue',
        label: 'Continue',
        icon: 'ChevronDown',
        variant: 'default',
        disabled: !state.details.time,
        onClick: () => dispatch({ type: 'SET_STEP', step: 2 }),
      },
    ];
    onActionsChange(actions);
  }, [dispatch, onActionsChange, state.details.time]);

  return (
    <Card className="mx-auto w-full max-w-4xl lg:max-w-5xl">
      <CardHeader className="space-y-4">
        <CardTitle className="text-[clamp(1.75rem,1.45rem+0.6vw,2.2rem)] text-srx-ink-strong">
          Plan your visit
        </CardTitle>
        <CardDescription className="text-body-sm text-srx-ink-soft">
          Choose a date, time, party size, and any preferences. We’ll show the best options
          available.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="grid gap-6 md:grid-cols-2">
          <section className="space-y-3">
            <Label>Date</Label>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  aria-label="Choose reservation date"
                >
                  {state.details.date ? (
                    <span>{bookingHelpers.formatDate(state.details.date)}</span>
                  ) : (
                    <span>Select a date</span>
                  )}
                  <Icon.Calendar className="ml-2 h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={state.details.date ? new Date(state.details.date) : undefined}
                  onSelect={(value) => {
                    const formatted = value ? bookingHelpers.formatForDateInput(value) : '';
                    dispatch({ type: 'SET_FIELD', key: 'date', value: formatted });
                    setOpen(false);
                  }}
                  disabled={(day) => (day ? day < minSelectableDate : false)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </section>

          <section className="space-y-3">
            <Label>Party size</Label>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() =>
                  dispatch({
                    type: 'SET_FIELD',
                    key: 'party',
                    value: Math.max(1, state.details.party - 1),
                  })
                }
                aria-label="Decrease guests"
              >
                -
              </Button>
              <div className="text-lg font-semibold" aria-live="polite">
                {state.details.party}
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() =>
                  dispatch({
                    type: 'SET_FIELD',
                    key: 'party',
                    value: Math.min(12, state.details.party + 1),
                  })
                }
                aria-label="Increase guests"
              >
                +
              </Button>
            </div>
          </section>
        </div>

        <section className="space-y-3">
          <Label htmlFor="time">Time</Label>
          <TooltipProvider>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {slots.map((slot) => {
                const isSelected = state.details.time === slot.value;
                const availability = getServiceAvailability(state.details.date, slot.value);
                const disabled =
                  availability.services[resolveDefaultService(state.details.date, slot.value)] ===
                  'disabled';

                return (
                  <Tooltip key={slot.value} delayDuration={hoveredSlot === slot.value ? 0 : 500}>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant={isSelected ? 'default' : 'outline'}
                        className="justify-between"
                        disabled={disabled}
                        onMouseEnter={() => setHoveredSlot(slot.value)}
                        onMouseLeave={() => setHoveredSlot(null)}
                        onFocus={() => setHoveredSlot(slot.value)}
                        onBlur={() => setHoveredSlot(null)}
                        onClick={() => handleSelectTime(slot.value)}
                      >
                        <span>{slot.display}</span>
                        <Badge variant="secondary">{slot.label}</Badge>
                      </Button>
                    </TooltipTrigger>
                    {disabled ? (
                      <TooltipContent side="top">{SERVICE_TOOLTIP}</TooltipContent>
                    ) : null}
                  </Tooltip>
                );
              })}
            </div>
          </TooltipProvider>
        </section>

        <section className="space-y-3">
          <Label>Occasion</Label>
          <ToggleGroup
            type="single"
            className="grid grid-cols-3 gap-2"
            value={state.details.bookingType}
            onValueChange={(value) =>
              dispatch({
                type: 'SET_FIELD',
                key: 'bookingType',
                value: (value as BookingOption) ?? state.details.bookingType,
              })
            }
          >
            {SERVICE_ORDER.map((option) => {
              const enabled = serviceAvailability.services[option] === 'enabled';
              return (
                <ToggleGroupItem
                  key={option}
                  value={option}
                  aria-disabled={!enabled}
                  disabled={!enabled}
                >
                  {SERVICE_LABELS[option]}
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
          <div className="flex flex-wrap gap-2 text-xs text-srx-ink-soft">
            {serviceAvailability.labels.happyHour ? (
              <Badge variant="outline">Happy hour selected</Badge>
            ) : null}
            {serviceAvailability.labels.drinksOnly ? (
              <Badge variant="outline">Drinks only</Badge>
            ) : null}
            {serviceAvailability.labels.kitchenClosed ? (
              <Badge variant="destructive">Kitchen closed</Badge>
            ) : null}
          </div>
        </section>

        <section className="space-y-3">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            placeholder="Birthday, accessibility needs, allergies…"
            value={state.details.notes}
            onChange={(event) =>
              dispatch({ type: 'SET_FIELD', key: 'notes', value: event.target.value })
            }
            rows={4}
          />
        </section>
      </CardContent>
    </Card>
  );
}
