'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';

import { Icon } from '@reserve/shared/ui/icons';
import { bookingHelpers, type BookingOption } from '@reserve/shared/utils/booking';
import { track } from '@shared/lib/analytics';
import { Badge } from '@shared/ui/badge';
import { Button } from '@shared/ui/button';
import { Calendar } from '@shared/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@shared/ui/form';
import { Popover, PopoverContent, PopoverTrigger } from '@shared/ui/popover';
import { Textarea } from '@shared/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@shared/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@shared/ui/tooltip';

import { planFormSchema, type PlanFormValues } from '../../model/schemas';

import type { State, StepAction } from '../../model/reducer';
import type { WizardActions } from '../../model/store';

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
  actions: Pick<WizardActions, 'updateDetails' | 'goToStep'>;
  onActionsChange: (actions: StepAction[]) => void;
}

export function PlanStep({ state, actions, onActionsChange }: PlanStepProps) {
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

  const form = useForm<PlanFormValues>({
    resolver: zodResolver(planFormSchema),
    mode: 'onChange',
    reValidateMode: 'onBlur',
    defaultValues: {
      date: state.details.date ?? '',
      time: state.details.time ?? '',
      party: state.details.party ?? 1,
      bookingType: state.details.bookingType,
      notes: state.details.notes ?? '',
    },
  });

  useEffect(() => {
    const current = form.getValues();
    const next: PlanFormValues = {
      date: state.details.date ?? '',
      time: state.details.time ?? '',
      party: state.details.party ?? 1,
      bookingType: state.details.bookingType,
      notes: state.details.notes ?? '',
    };

    if (
      current.date !== next.date ||
      current.time !== next.time ||
      current.party !== next.party ||
      current.bookingType !== next.bookingType ||
      (current.notes ?? '') !== (next.notes ?? '')
    ) {
      form.reset(next, { keepDirty: false, keepTouched: false });
    }
  }, [
    form,
    state.details.date,
    state.details.time,
    state.details.party,
    state.details.bookingType,
    state.details.notes,
  ]);

  const handleError = useCallback(
    (errors: Record<string, unknown>) => {
      const firstKey = Object.keys(errors)[0];
      if (firstKey) {
        form.setFocus(firstKey as keyof PlanFormValues, { shouldSelect: true });
      }
    },
    [form],
  );

  const updateField = useCallback(
    <K extends keyof State['details']>(key: K, value: State['details'][K]) => {
      actions.updateDetails(key, value);
    },
    [actions],
  );

  const handleSubmit = useCallback(
    (values: PlanFormValues) => {
      updateField('date', values.date);
      updateField('time', values.time);
      updateField('party', values.party);
      updateField('bookingType', values.bookingType);
      updateField('notes', values.notes ?? '');
      actions.goToStep(2);
    },
    [actions, updateField],
  );

  const handleSelectDate = useCallback(
    (value: Date | undefined | null) => {
      const formatted = value ? bookingHelpers.formatForDateInput(value) : '';
      form.setValue('date', formatted, { shouldDirty: true, shouldValidate: true });
      updateField('date', formatted);
      setOpen(false);
    },
    [form, updateField],
  );

  const handleSelectTime = useCallback(
    (value: string) => {
      form.setValue('time', value, { shouldDirty: true, shouldValidate: true });
      updateField('time', value);
      const inferredService = resolveDefaultService(state.details.date, value);
      form.setValue('bookingType', inferredService, { shouldDirty: true, shouldValidate: true });
      updateField('bookingType', inferredService);
      track('select_time', {
        time: value,
        booking_type: inferredService,
      });
    },
    [form, state.details.date, updateField],
  );

  const handlePartyChange = useCallback(
    (direction: 'decrement' | 'increment') => {
      const current = form.getValues('party');
      const next = direction === 'decrement' ? Math.max(1, current - 1) : Math.min(12, current + 1);
      form.setValue('party', next, { shouldDirty: true, shouldValidate: true });
      updateField('party', next);
    },
    [form, updateField],
  );

  const handleOccasionChange = useCallback(
    (value: string) => {
      if (!value) return;
      const typed = value as BookingOption;
      form.setValue('bookingType', typed, { shouldDirty: true, shouldValidate: true });
      updateField('bookingType', typed);
    },
    [form, updateField],
  );

  const { isSubmitting, isValid } = form.formState;

  useEffect(() => {
    const submit = () => form.handleSubmit(handleSubmit, handleError)();
    const stepActions: StepAction[] = [
      {
        id: 'plan-continue',
        label: 'Continue',
        icon: 'ChevronDown',
        variant: 'default',
        disabled: isSubmitting || !isValid,
        loading: isSubmitting,
        onClick: submit,
      },
    ];
    onActionsChange(stepActions);
  }, [form, handleError, handleSubmit, isSubmitting, isValid, onActionsChange]);

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
        <Form {...form}>
          <form
            className="space-y-8"
            onSubmit={form.handleSubmit(handleSubmit, handleError)}
            noValidate
          >
            <button type="submit" className="hidden" aria-hidden />

            <div className="grid gap-6 md:grid-cols-2">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Date</FormLabel>
                    <Popover open={open} onOpenChange={setOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className="w-full justify-between"
                            aria-label="Choose reservation date"
                          >
                            {field.value ? (
                              <span>{bookingHelpers.formatDate(field.value)}</span>
                            ) : (
                              <span>Select a date</span>
                            )}
                            <Icon.Calendar className="ml-2 h-4 w-4" aria-hidden />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value ? new Date(field.value) : undefined}
                          onSelect={handleSelectDate}
                          disabled={(day) => (day ? day < minSelectableDate : false)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage>{form.formState.errors.date?.message}</FormMessage>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="party"
                render={({ field }) => (
                  <FormItem className="space-y-3">
                    <FormLabel>Party size</FormLabel>
                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => handlePartyChange('decrement')}
                        aria-label="Decrease guests"
                      >
                        -
                      </Button>
                      <div className="text-lg font-semibold" aria-live="polite">
                        {field.value}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => handlePartyChange('increment')}
                        aria-label="Increase guests"
                      >
                        +
                      </Button>
                    </div>
                    <FormDescription>
                      Tables of more than 12? Call us and we’ll help.
                    </FormDescription>
                    <FormMessage>{form.formState.errors.party?.message}</FormMessage>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="time"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Time</FormLabel>
                  <TooltipProvider>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {slots.map((slot) => {
                        const isSelected = field.value === slot.value;
                        const availability = getServiceAvailability(state.details.date, slot.value);
                        const inferred = resolveDefaultService(state.details.date, slot.value);
                        const disabled = availability.services[inferred] === 'disabled';
                        return (
                          <Tooltip
                            key={slot.value}
                            delayDuration={hoveredSlot === slot.value ? 0 : 500}
                          >
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant={isSelected ? 'default' : 'outline'}
                                className="justify-between"
                                disabled={disabled}
                                data-state={isSelected ? 'on' : 'off'}
                                onMouseEnter={() => setHoveredSlot(slot.value)}
                                onMouseLeave={() => setHoveredSlot(null)}
                                onFocus={() => setHoveredSlot(slot.value)}
                                onBlur={() => setHoveredSlot(null)}
                                onClick={() => {
                                  if (disabled) return;
                                  handleSelectTime(slot.value);
                                }}
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
                  <FormMessage>{form.formState.errors.time?.message}</FormMessage>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bookingType"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Occasion</FormLabel>
                  <ToggleGroup
                    type="single"
                    className="grid grid-cols-3 gap-2"
                    value={field.value}
                    onValueChange={handleOccasionChange}
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
                  <FormMessage>{form.formState.errors.bookingType?.message}</FormMessage>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel htmlFor="notes">Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      id="notes"
                      placeholder="Birthday, accessibility needs, allergies…"
                      value={field.value ?? ''}
                      onChange={(event) => {
                        field.onChange(event);
                        updateField('notes', event.target.value);
                      }}
                      rows={4}
                      spellCheck
                    />
                  </FormControl>
                  <FormDescription>
                    Optional. Share anything we should know before you arrive.
                  </FormDescription>
                  <div className="text-right text-xs text-srx-ink-soft" aria-live="polite">
                    {(field.value?.length ?? 0).toString()} / 500
                  </div>
                  <FormMessage>{form.formState.errors.notes?.message}</FormMessage>
                </FormItem>
              )}
            />
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
