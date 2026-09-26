'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, MinusIcon, PlusIcon, UsersIcon } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Controller, useForm, type Resolver } from 'react-hook-form';
import { z } from 'zod';

import { ScheduleAwareTimestampPicker } from '@/components/features/booking-state-machine';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormDescription,
  FormField,
  FormItem,
  FormMessage,
  FormRoot,
} from '@/components/ui/form';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useOpsUpdateBooking } from '@/hooks/ops/useOpsUpdateBooking';
import { useUpdateBooking } from '@/hooks/useUpdateBooking';
import { emit } from '@/lib/analytics/emit';
import { BOOKING_IN_PAST_DASHBOARD_MESSAGE } from '@/lib/bookings/messages';
import {
  MAX_ONLINE_PARTY_SIZE,
  MIN_ONLINE_PARTY_SIZE,
  ONLINE_PARTY_SIZE_LIMIT_COPY,
} from '@/lib/bookings/partySize';
import { cn } from '@/lib/utils';

import {
  GUEST_ACCESS_LINK_ERROR_COPY,
  GuestNewLinkCta,
  isGuestAccessLinkErrorCode,
} from './GuestNewLinkCta';

import type { BookingDTO } from '@/hooks/useBookings';
import type { HttpError } from '@/lib/http/errors';

const errorCopy: Record<string, string> = {
  OVERLAP_DETECTED: 'That time overlaps an existing booking. Please choose another slot.',
  CUTOFF_PASSED: 'This booking can no longer be changed online. Please contact the venue.',
  PENDING_LOCKED: 'This booking is still pending review. Please contact the venue to adjust it.',
  CLOSED_DATE: 'The restaurant is closed on the selected date. Please choose another day.',
  BOOKING_NOT_FOUND: 'We couldn’t find that booking.',
  BOOKING_LOOKUP_FAILED: 'We couldn’t load this booking. Please refresh and try again.',
  FORBIDDEN: 'You don’t have permission to modify this booking.',
  UNAUTHENTICATED: 'Please sign in again to continue.',
  SESSION_RESOLUTION_FAILED: 'We couldn’t confirm your session. Refresh the page and try again.',
  MEMBERSHIP_VALIDATION_FAILED:
    'We hit a problem checking your access. Try again or contact an admin.',
  INVALID_INPUT: 'Please check the fields and try again.',
  INVALID_TIME: 'Enter a valid time and try again.',
  OUTSIDE_HOURS:
    'Selected time is outside operating hours. Pick a time between opening and closing.',
  SERVICE_PERIOD: 'Selected time isn’t available for this service. Try another slot.',
  CAPACITY_EXCEEDED: 'No availability at that time. Please choose a different time.',
  PAST_TIME: 'That time has already passed. Choose an upcoming slot.',
  BOOKING_IN_PAST: BOOKING_IN_PAST_DASHBOARD_MESSAGE,
  UNKNOWN: 'Something went wrong on our side. Please try again.',
};

const NOTES_LIMIT = 500;

function DialogPartySizeField({
  value,
  onChange,
  error,
}: {
  value: number;
  onChange: (direction: 'decrement' | 'increment') => void;
  error?: string;
}) {
  const labelId = React.useId();
  const descriptionId = React.useId();
  const canDecrement = value > MIN_ONLINE_PARTY_SIZE;
  const canIncrement = value < MAX_ONLINE_PARTY_SIZE;
  const partyLabel = value === 1 ? 'guest' : 'guests';

  return (
    <FormItem className="flex flex-col gap-3">
      <div id={labelId} className="flex items-center gap-1.5 px-1 text-sm font-semibold">
        <UsersIcon className="size-4 text-muted-foreground" aria-hidden="true" />
        <span>Party size</span>
      </div>
      <div
        className={cn(
          'grid h-12 w-full grid-cols-[44px_minmax(0,1fr)_44px] items-center overflow-hidden rounded-md border border-input bg-background transition-colors focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/25 sm:grid-cols-[56px_minmax(0,1fr)_56px]',
          error && 'border-destructive ring-1 ring-destructive/20',
        )}
        role="group"
        aria-labelledby={labelId}
        aria-describedby={descriptionId}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onChange('decrement')}
          disabled={!canDecrement}
          aria-label="Decrease guests"
          className="h-full w-full shrink-0 rounded-none border-r border-border/70 text-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"
        >
          <MinusIcon data-icon="icon" aria-hidden="true" />
        </Button>
        <div
          className="flex h-8 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap px-1.5"
          aria-live="polite"
          aria-atomic="true"
          aria-label={`${value} ${partyLabel}`}
        >
          <span className="text-xl font-semibold leading-none tabular-nums text-foreground sm:text-2xl">
            {value}
          </span>
          <span className="text-xs font-medium leading-none text-muted-foreground sm:text-sm">
            {partyLabel}
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onChange('increment')}
          disabled={!canIncrement}
          aria-label="Increase guests"
          className="h-full w-full shrink-0 rounded-none border-l border-border/70 text-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"
        >
          <PlusIcon data-icon="icon" aria-hidden="true" />
        </Button>
      </div>
      <FormDescription id={descriptionId} className="px-1 text-xs">
        {ONLINE_PARTY_SIZE_LIMIT_COPY}
      </FormDescription>
      <FormMessage>{error}</FormMessage>
    </FormItem>
  );
}

const schema = z.object({
  start: z
    .string()
    .min(1, 'Select a start time')
    .refine((value) => {
      const date = new Date(value);
      return !Number.isNaN(date.getTime());
    }, 'Select a valid start time'),
  partySize: z.coerce
    .number()
    .int()
    .min(MIN_ONLINE_PARTY_SIZE, 'Party size must be at least 1')
    .max(MAX_ONLINE_PARTY_SIZE, ONLINE_PARTY_SIZE_LIMIT_COPY),
  notes: z.string().max(500, 'Notes must be 500 characters or less').nullable().optional(),
});

type FormValues = z.infer<typeof schema>;

export type EditBookingDialogProps = {
  booking: BookingDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantSlug?: string | null;
  restaurantTimezone?: string | null;
  mode?: 'guest' | 'ops';
};

const formResolver = zodResolver(schema) as Resolver<FormValues>;

const toDefaultValues = (booking: BookingDTO | null): FormValues => ({
  start: booking?.startIso ?? '',
  partySize: booking?.partySize ?? 2,
  notes: booking?.notes ?? '',
});

const deriveFallbackDurationMinutes = (booking: BookingDTO | null): number => {
  if (!booking?.startIso || !booking?.endIso) {
    return 90;
  }
  const startDate = new Date(booking.startIso);
  const endDate = new Date(booking.endIso);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return 90;
  }
  const diffMinutes = Math.round((endDate.getTime() - startDate.getTime()) / 60000);
  return diffMinutes > 0 ? diffMinutes : 90;
};

const deriveEndState = (startValue: string | null | undefined, fallbackDurationMinutes: number) => {
  if (!startValue) {
    return {
      endDate: null,
      endIso: null,
      durationLabel: `${fallbackDurationMinutes}m`,
      endDisplay: 'Select a start time to see the end time',
    };
  }

  const startDate = new Date(startValue);
  if (Number.isNaN(startDate.getTime())) {
    return {
      endDate: null,
      endIso: null,
      durationLabel: `${fallbackDurationMinutes}m`,
      endDisplay: 'Select a valid start time',
    };
  }

  const endDate = new Date(startDate.getTime() + fallbackDurationMinutes * 60_000);
  const endIso = endDate.toISOString();

  const minutes = fallbackDurationMinutes;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  const durationLabel = hours > 0 ? `${hours}h${remainder ? ` ${remainder}m` : ''}` : `${minutes}m`;

  let endDisplay = 'Select a start time to see the end time';
  try {
    endDisplay = new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(endDate);
  } catch {
    endDisplay = endDate.toLocaleString();
  }

  return { endDate, endIso, durationLabel, endDisplay };
};

type EditBookingMutationInput = {
  id: string;
  startIso: string;
  endIso: string;
  partySize: number;
  notes?: string | null;
  restaurantId?: string | null;
};

type EditBookingMutation = {
  mutateAsync: (input: EditBookingMutationInput) => Promise<unknown>;
  isPending: boolean;
  error: HttpError | null;
};

type UseEditBookingDialogState = {
  form: ReturnType<typeof useForm<FormValues>>;
  control: ReturnType<typeof useForm<FormValues>>['control'];
  errors: ReturnType<typeof useForm<FormValues>>['formState']['errors'];
  derivedEndIso: string | null;
  derivedEndDisplay: string;
  derivedDurationLabel: string;
  fallbackMinDate: Date;
  effectiveRestaurantTimezone: string | null;
  effectiveRestaurantSlug: string | null;
  missingScheduleMetadata: boolean;
  hasCommittedStart: boolean;
  isDirty: boolean;
  notesValue: string;
  currentStartDisplay: string;
  handleDateChange: (nextDateIso: string | null) => void;
  handleStartValueChange: (next: string | null) => void;
  handlePartySizeChange: (direction: 'increment' | 'decrement') => void;
  activeError: { message: string; code?: string } | null;
  alertTitle: string;
  handleSubmit: () => void;
};

type UseEditBookingDialogParams = EditBookingDialogProps & {
  mutation: EditBookingMutation;
  includeRestaurantId?: boolean;
  /** Guest dialogs offer a new emailed link when the booking link expired or was revoked. */
  guestAccessRecovery?: boolean;
};

function useEditBookingDialogState({
  booking,
  open,
  onOpenChange,
  restaurantSlug: restaurantSlugOverride,
  restaurantTimezone: restaurantTimezoneOverride,
  mutation,
  includeRestaurantId = false,
  guestAccessRecovery = false,
}: UseEditBookingDialogParams): UseEditBookingDialogState {
  const copyForCode = useCallback(
    (code: string | undefined): string | undefined => {
      if (!code) return undefined;
      // Guest dialogs prefer the link-recovery copy (e.g. UNAUTHENTICATED after the booking
      // cookie expired); ops copy is unchanged.
      if (guestAccessRecovery) return GUEST_ACCESS_LINK_ERROR_COPY[code] ?? errorCopy[code];
      return errorCopy[code];
    },
    [guestAccessRecovery],
  );
  const defaultValues = useMemo(() => toDefaultValues(booking), [booking]);
  const resolver = formResolver;
  const form = useForm<FormValues>({
    resolver,
    defaultValues,
  });

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
    clearErrors,
    formState: { errors, isDirty },
  } = form;

  const [formError, setFormError] = useState<{ message: string; code?: string } | null>(null);
  // eslint-disable-next-line react-hooks/incompatible-library
  const startValue = watch('start');
  const hasCommittedStart =
    typeof startValue === 'string' ? startValue.trim().length > 0 : Boolean(startValue);

  const effectiveRestaurantSlug = useMemo(
    () => restaurantSlugOverride ?? booking?.restaurants?.slug ?? booking?.restaurantSlug ?? null,
    [booking?.restaurants?.slug, booking?.restaurantSlug, restaurantSlugOverride],
  );

  const effectiveRestaurantTimezone = useMemo(
    () =>
      restaurantTimezoneOverride ??
      booking?.restaurants?.timezone ??
      booking?.restaurantTimezone ??
      null,
    [booking?.restaurants?.timezone, booking?.restaurantTimezone, restaurantTimezoneOverride],
  );

  const missingScheduleMetadata = !effectiveRestaurantSlug;

  const fallbackMinDate = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }, []);

  const fallbackDurationMinutes = useMemo(() => deriveFallbackDurationMinutes(booking), [booking]);
  const {
    endIso: derivedEndIso,
    endDisplay: derivedEndDisplay,
    durationLabel: derivedDurationLabel,
  } = useMemo(
    () => deriveEndState(startValue, fallbackDurationMinutes),
    [fallbackDurationMinutes, startValue],
  );

  useEffect(() => {
    if (open && booking) {
      emit('booking_edit_opened', { bookingId: booking.id });
      reset(defaultValues);
      setFormError(null);
    }
  }, [booking, defaultValues, open, reset]);

  const handleDateChange = useCallback(
    (nextDateIso: string | null) => {
      if (nextDateIso === null) {
        setValue('start', '', {
          shouldValidate: true,
          shouldDirty: true,
          shouldTouch: true,
        });
      }
    },
    [setValue],
  );

  const handleStartValueChange = useCallback(
    (next: string | null) => {
      const nextValue = next ?? '';
      setValue('start', nextValue, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
      if (nextValue) {
        clearErrors('start');
      }
    },
    [clearErrors, setValue],
  );

  const clampPartySize = useCallback(
    (value: number) => Math.min(MAX_ONLINE_PARTY_SIZE, Math.max(MIN_ONLINE_PARTY_SIZE, value)),
    [],
  );

  const handlePartySizeChange = useCallback(
    (direction: 'increment' | 'decrement') => {
      const current = Number(getValues('partySize') ?? MIN_ONLINE_PARTY_SIZE);
      const delta = direction === 'increment' ? 1 : -1;
      const next = clampPartySize(current + delta);

      setValue('partySize', next, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
      clearErrors('partySize');
    },
    [clampPartySize, clearErrors, getValues, setValue],
  );

  const onSubmit = useCallback(
    async (values: FormValues) => {
      if (!booking) return;
      setFormError(null);
      const startIso = values.start;
      const startDate = new Date(startIso);
      const endIso = derivedEndIso;

      if (!startIso || Number.isNaN(startDate.getTime()) || !endIso) {
        return;
      }

      try {
        const payload: EditBookingMutationInput = {
          id: booking.id,
          startIso,
          endIso,
          partySize: values.partySize,
          notes: values.notes ?? null,
        };
        if (includeRestaurantId) {
          payload.restaurantId = booking.restaurantId ?? null;
        }
        await mutation.mutateAsync(payload);
        onOpenChange(false);
      } catch (error) {
        const err = error as HttpError;
        const code = err?.code;
        const preset = copyForCode(code);
        const message = preset ?? err?.message ?? 'Something went wrong. Please try again.';

        setFormError({ message, code });
      }
    },
    [booking, copyForCode, derivedEndIso, includeRestaurantId, mutation, onOpenChange],
  );

  const mutationError = mutation.error as HttpError | null;
  const fallbackMessage = mutationError?.code
    ? (copyForCode(mutationError.code) ?? mutationError.message)
    : mutationError?.message;
  const activeError =
    formError ?? (fallbackMessage ? { message: fallbackMessage, code: mutationError?.code } : null);
  const isPastTimeError = activeError?.code === 'BOOKING_IN_PAST';
  const alertTitle = isPastTimeError ? 'Booking time is in the past' : 'Unable to save changes';
  const notesValue = watch('notes') ?? '';
  const currentStartDisplay = useMemo(() => {
    const start = booking?.startIso;
    if (!start) return 'Not set';
    try {
      return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
        new Date(start),
      );
    } catch {
      return start;
    }
  }, [booking?.startIso]);

  return {
    form,
    control,
    errors,
    derivedEndIso,
    derivedEndDisplay,
    derivedDurationLabel,
    fallbackMinDate,
    missingScheduleMetadata,
    effectiveRestaurantSlug,
    effectiveRestaurantTimezone,
    hasCommittedStart,
    isDirty,
    notesValue,
    currentStartDisplay,
    handleDateChange,
    handleStartValueChange,
    handlePartySizeChange,
    activeError,
    alertTitle,
    handleSubmit: handleSubmit(onSubmit),
  };
}

function useGuestEditBookingMutation(): EditBookingMutation {
  const mutation = useUpdateBooking();
  return {
    mutateAsync: async (input) =>
      mutation.mutateAsync({
        id: input.id,
        startIso: input.startIso,
        endIso: input.endIso,
        partySize: input.partySize,
        notes: input.notes ?? null,
      }),
    isPending: mutation.isPending,
    error: mutation.error ?? null,
  };
}

function useOpsEditBookingMutation(): EditBookingMutation {
  const mutation = useOpsUpdateBooking();
  return {
    mutateAsync: async (input) =>
      mutation.mutateAsync({
        id: input.id,
        startIso: input.startIso,
        endIso: input.endIso,
        partySize: input.partySize,
        notes: input.notes ?? null,
        restaurantId: input.restaurantId ?? null,
      }),
    isPending: mutation.isPending,
    error: mutation.error ?? null,
  };
}

function EditBookingDialogBase({
  booking,
  open,
  onOpenChange,
  restaurantSlug: restaurantSlugOverride,
  restaurantTimezone: restaurantTimezoneOverride,
  mutation,
  includeRestaurantId = false,
  guestAccessRecovery = false,
}: UseEditBookingDialogParams) {
  const {
    form,
    control,
    errors,
    derivedEndDisplay,
    derivedDurationLabel,
    fallbackMinDate,
    effectiveRestaurantTimezone,
    effectiveRestaurantSlug,
    missingScheduleMetadata,
    hasCommittedStart,
    isDirty,
    notesValue,
    currentStartDisplay,
    handleDateChange,
    handleStartValueChange,
    handlePartySizeChange,
    activeError,
    alertTitle,
    handleSubmit,
  } = useEditBookingDialogState({
    booking,
    open,
    onOpenChange,
    restaurantSlug: restaurantSlugOverride,
    restaurantTimezone: restaurantTimezoneOverride,
    mutation,
    includeRestaurantId,
    guestAccessRecovery,
  });

  const showNewLinkCta = guestAccessRecovery && isGuestAccessLinkErrorCode(activeError?.code);
  const showReassignmentNotice = isDirty;
  const isSaving = mutation.isPending;
  const notesLength = notesValue?.length ?? 0;
  const notesRemaining = Math.max(0, NOTES_LIMIT - notesLength);
  const timezoneLabel = effectiveRestaurantTimezone ?? 'Local time';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[90dvh] flex-col overflow-hidden sm:max-w-3xl"
        onInteractOutside={(event) => event.preventDefault()}
      >
        <Form {...form}>
          <FormRoot onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col" noValidate>
            {/* DialogHeader outside the scrollable area */}
            <DialogHeader className="px-6 pt-5 sm:px-8 sm:pt-6 space-y-2 shrink-0">
              <DialogTitle className="text-xl font-semibold text-foreground">
                Edit booking
              </DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                Adjust booking details · Service timezone: {timezoneLabel}
              </DialogDescription>
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
                <Badge
                  variant="secondary"
                  className="rounded-full px-3 py-1 text-[12px] font-semibold text-foreground"
                >
                  Current start: {currentStartDisplay}
                </Badge>
                <Badge variant="outline" className="rounded-full px-3 py-1 text-[12px]">
                  Duration: {derivedDurationLabel}
                </Badge>
                <Badge variant="outline" className="rounded-full px-3 py-1 text-[12px]">
                  New end: {derivedEndDisplay}
                </Badge>
              </div>
            </DialogHeader>

            {/* Alerts placed between header and scrollable body */}
            <div className="px-6 sm:px-8 space-y-3 shrink-0">
              {showReassignmentNotice ? (
                <Alert variant="warning" role="status" aria-live="polite">
                  <AlertTitle>Heads up</AlertTitle>
                  <AlertDescription>
                    Changing time or party size may release the current table and reassign
                    availability.
                  </AlertDescription>
                </Alert>
              ) : null}

              {missingScheduleMetadata ? (
                <Alert variant="destructive" role="alert">
                  <AlertTitle>Availability unavailable</AlertTitle>
                  <AlertDescription>
                    We need restaurant schedule data to edit this booking. Try refreshing or contact
                    support.
                  </AlertDescription>
                </Alert>
              ) : null}
            </div>

            {/* Main scrollable body content */}
            <div className="flex-1 min-h-0 space-y-5 overflow-y-auto px-6 py-5 sm:px-8 sm:py-6">
              <div className="grid gap-4">
                <Controller
                  name="start"
                  control={control}
                  render={({ field, fieldState }) => (
                    <ScheduleAwareTimestampPicker
                      restaurantSlug={effectiveRestaurantSlug}
                      restaurantTimezone={effectiveRestaurantTimezone}
                      value={field.value || null}
                      onChange={(next) => {
                        handleStartValueChange(next);
                        field.onChange(next ?? '');
                      }}
                      onDateChange={handleDateChange}
                      onBlur={field.onBlur}
                      label="Plan your visit"
                      description="Choose a date, time, and party size. We'll show available options."
                      errorMessage={fieldState.error?.message ?? null}
                      disabled={isSaving || missingScheduleMetadata}
                      minDate={fallbackMinDate}
                      targetService={booking?.booking_type ?? null}
                    >
                      <FormField
                        control={control}
                        name="partySize"
                        render={({ field: partyField }) => (
                          <DialogPartySizeField
                            value={partyField.value ?? MIN_ONLINE_PARTY_SIZE}
                            onChange={handlePartySizeChange}
                            error={errors.partySize?.message}
                          />
                        )}
                      />
                    </ScheduleAwareTimestampPicker>
                  )}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Controller
                  name="notes"
                  control={control}
                  render={({ field }) => (
                    <Textarea
                      id="notes"
                      rows={3}
                      {...field}
                      value={field.value ?? ''}
                      onChange={(event) => field.onChange(event.target.value)}
                      maxLength={NOTES_LIMIT}
                    />
                  )}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  {errors.notes ? (
                    <span className="text-destructive">{errors.notes.message}</span>
                  ) : (
                    <span>Optional context for the team.</span>
                  )}
                  <span>{notesRemaining} chars left</span>
                </div>
              </div>

              {activeError ? (
                <Alert variant="destructive" role="alert">
                  <AlertTitle>{alertTitle}</AlertTitle>
                  <AlertDescription>{activeError.message}</AlertDescription>
                  {showNewLinkCta ? (
                    <div className="mt-3">
                      <GuestNewLinkCta restaurantSlug={effectiveRestaurantSlug} />
                    </div>
                  ) : null}
                </Alert>
              ) : null}
            </div>

            <div className="mt-4 bg-card px-6 pb-5 pt-3 sm:px-8 sm:pb-6">
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving || missingScheduleMetadata || !hasCommittedStart || !isDirty}
                  className={cn('min-w-[130px]', isSaving && 'cursor-wait')}
                >
                  {isSaving ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" aria-hidden /> Saving…
                    </span>
                  ) : missingScheduleMetadata ? (
                    'Unavailable'
                  ) : (
                    'Save changes'
                  )}
                </Button>
              </DialogFooter>
            </div>
          </FormRoot>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function EditBookingDialogGuest(props: EditBookingDialogProps) {
  const mutation = useGuestEditBookingMutation();
  return (
    <EditBookingDialogBase
      {...props}
      mutation={mutation}
      includeRestaurantId={false}
      guestAccessRecovery
    />
  );
}

function EditBookingDialogOps(props: EditBookingDialogProps) {
  const mutation = useOpsEditBookingMutation();
  return <EditBookingDialogBase {...props} mutation={mutation} includeRestaurantId />;
}

export function EditBookingDialog(props: EditBookingDialogProps) {
  if (props.mode === 'ops') {
    return <EditBookingDialogOps {...props} />;
  }
  return <EditBookingDialogGuest {...props} />;
}
