'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Controller, useForm, type Resolver } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'react-hot-toast';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScheduleAwareTimestampPicker, TimestampPicker } from '@/components/features/booking-state-machine';
import type { BookingDTO } from '@/hooks/useBookings';
import { useUpdateBooking } from '@/hooks/useUpdateBooking';
import { BOOKING_IN_PAST_DASHBOARD_MESSAGE } from '@/lib/bookings/messages';
import type { HttpError } from '@/lib/http/errors';
import { emit } from '@/lib/analytics/emit';
import { DEFAULT_VENUE } from '@shared/config/venue';

const errorCopy: Record<string, string> = {
  OVERLAP_DETECTED: 'That time overlaps an existing booking. Please choose another slot.',
  CUTOFF_PASSED: 'This booking can no longer be changed online. Please contact the venue.',
  BOOKING_NOT_FOUND: 'We couldn’t find that booking.',
  BOOKING_LOOKUP_FAILED: 'We couldn’t load this booking. Please refresh and try again.',
  FORBIDDEN: 'You don’t have permission to modify this booking.',
  UNAUTHENTICATED: 'Please sign in again to continue.',
  SESSION_RESOLUTION_FAILED: 'We couldn’t confirm your session. Refresh the page and try again.',
  MEMBERSHIP_VALIDATION_FAILED: 'We hit a problem checking your access. Try again or contact an admin.',
  INVALID_INPUT: 'Please check the fields and try again.',
  BOOKING_IN_PAST: BOOKING_IN_PAST_DASHBOARD_MESSAGE,
  UNKNOWN: 'Something went wrong on our side. Please try again.',
};

const schema = z.object({
  start: z
    .string()
    .min(1, 'Select a start time')
    .refine((value) => {
      const date = new Date(value);
      return !Number.isNaN(date.getTime());
    }, 'Select a valid start time'),
  partySize: z.coerce.number().int().min(1, 'Party size must be at least 1'),
  notes: z.string().max(500, 'Notes must be 500 characters or less').nullable().optional(),
});

type FormValues = z.infer<typeof schema>;

type UseUpdateBookingHook = () => ReturnType<typeof useUpdateBooking>;

export type EditBookingDialogProps = {
  booking: BookingDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mutationHook?: UseUpdateBookingHook;
  restaurantSlug?: string | null;
  restaurantTimezone?: string | null;
  scheduleParityEnabled?: boolean;
};

export function EditBookingDialog({
  booking,
  open,
  onOpenChange,
  mutationHook,
  restaurantSlug: restaurantSlugOverride,
  restaurantTimezone: restaurantTimezoneOverride,
  scheduleParityEnabled = false,
}: EditBookingDialogProps) {
  const defaultValues = useMemo<FormValues>(
    () => ({
      start: booking?.startIso ?? '',
      partySize: booking?.partySize ?? 2,
      notes: booking?.notes ?? '',
    }),
    [booking?.notes, booking?.partySize, booking?.startIso],
  );

  const intervalMinutes = useMemo(() => {
    const raw = booking?.reservationIntervalMinutes;
    if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 1 && raw <= 180) {
      return Math.floor(raw);
    }
    return 15;
  }, [booking?.reservationIntervalMinutes]);

  const resolver = zodResolver(schema) as Resolver<FormValues>;

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver,
    defaultValues,
  });
  const useMutationHook = mutationHook ?? useUpdateBooking;
  const mutation = useMutationHook();
  const [formError, setFormError] = useState<{ message: string; code?: string } | null>(null);
  const startValue = watch('start');

  const effectiveRestaurantSlug = useMemo(() => {
    return (
      restaurantSlugOverride ??
      booking?.restaurantSlug ??
      DEFAULT_VENUE.slug
    );
  }, [booking?.restaurantSlug, restaurantSlugOverride]);

  const effectiveRestaurantTimezone = useMemo(() => {
    return (
      restaurantTimezoneOverride ??
      booking?.restaurantTimezone ??
      DEFAULT_VENUE.timezone
    );
  }, [booking?.restaurantTimezone, restaurantTimezoneOverride]);

  const shouldUseSchedulePicker =
    scheduleParityEnabled && Boolean(effectiveRestaurantSlug);

  const fallbackDurationMinutes = useMemo(() => {
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
  }, [booking?.endIso, booking?.startIso]);

  const derivedEndDate = useMemo(() => {
    if (!startValue) {
      return null;
    }
    const startDate = new Date(startValue);
    if (Number.isNaN(startDate.getTime())) {
      return null;
    }
    const minutes = fallbackDurationMinutes;
    return new Date(startDate.getTime() + minutes * 60_000);
  }, [fallbackDurationMinutes, startValue]);

  const derivedEndIso = useMemo(() => (derivedEndDate ? derivedEndDate.toISOString() : null), [derivedEndDate]);

  const derivedDurationLabel = useMemo(() => {
    const minutes = fallbackDurationMinutes;
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    if (hours > 0 && remainder > 0) {
      return `${hours}h ${remainder}m`;
    }
    if (hours > 0) {
      return `${hours}h`;
    }
    return `${minutes}m`;
  }, [fallbackDurationMinutes]);

  const derivedEndDisplay = useMemo(() => {
    if (!derivedEndDate) {
      return 'Select a start time to see the end time';
    }
    try {
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(derivedEndDate);
    } catch {
      return derivedEndDate.toLocaleString();
    }
  }, [derivedEndDate]);

  useEffect(() => {
    if (open && booking) {
      emit('booking_edit_opened', { bookingId: booking.id });
      reset(defaultValues);
      setFormError(null);
    }
  }, [booking, defaultValues, open, reset]);

  const onSubmit = async (values: z.infer<typeof schema>) => {
    if (!booking) return;
    setFormError(null);
    const startIso = values.start;
    const startDate = new Date(startIso);
    const endIso = derivedEndIso;

    if (!startIso || Number.isNaN(startDate.getTime()) || !endIso) {
      toast.error('Please provide valid date and time');
      return;
    }

    try {
      await mutation.mutateAsync({
        id: booking.id,
        startIso,
        endIso,
        partySize: values.partySize,
        notes: values.notes ?? null,
      });
      onOpenChange(false);
    } catch (error) {
      const err = error as HttpError;
      const code = err?.code;
      const preset = code ? errorCopy[code] : null;
      const message = preset ?? err?.message ?? 'Something went wrong. Please try again.';

      if (message) {
        setFormError({ message, code });
        return;
      }

      setFormError({ message: 'Something went wrong. Please try again.', code });
    }
  };

  const mutationError = mutation.error as HttpError | null;
  const fallbackMessage = mutationError?.code ? errorCopy[mutationError.code] ?? mutationError.message : mutationError?.message;
  const activeError = formError ?? (fallbackMessage ? { message: fallbackMessage, code: mutationError?.code } : null);
  const isPastTimeError = activeError?.code === 'BOOKING_IN_PAST';
  const alertTitle = isPastTimeError ? 'Booking time is in the past' : 'Unable to save changes';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onInteractOutside={(event) => event.preventDefault()}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <DialogHeader>
            <DialogTitle>Edit booking</DialogTitle>
            <DialogDescription>Adjust the booking details and save your changes.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Controller
                name="start"
                control={control}
                render={({ field, fieldState }) => (
                  shouldUseSchedulePicker ? (
                    <ScheduleAwareTimestampPicker
                      restaurantSlug={effectiveRestaurantSlug}
                      restaurantTimezone={effectiveRestaurantTimezone}
                      value={field.value || null}
                      onChange={(next) => field.onChange(next ?? '')}
                      onBlur={field.onBlur}
                      label="Start time"
                      errorMessage={fieldState.error?.message ?? null}
                      disabled={mutation.isPending}
                    />
                  ) : (
                    <TimestampPicker
                      label="Start time"
                      name={field.name}
                      value={field.value}
                      onChange={(next) => field.onChange(next ?? '')}
                      onBlur={field.onBlur}
                      presets={[]}
                      required
                      errorMessage={fieldState.error?.message}
                      disabled={mutation.isPending}
                      minuteStep={intervalMinutes}
                    />
                  )
                )}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-booking-end">End time</Label>
              <div
                id="edit-booking-end"
                className="rounded-md border border-input bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
                aria-live="polite"
              >
                {derivedEndDisplay}
              </div>
              <p className="text-xs text-muted-foreground">
                Automatically set to {derivedDurationLabel} after the selected start time.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="partySize">Party size</Label>
              <Controller
                name="partySize"
                control={control}
                render={({ field }) => <Input id="partySize" type="number" min={1} {...field} />}
              />
              {errors.partySize ? <p className="text-sm text-destructive">{errors.partySize.message}</p> : null}
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
                    value={field.value ?? ""}
                    onChange={(event) => field.onChange(event.target.value)}
                  />
                )}
              />
              {errors.notes ? <p className="text-sm text-destructive">{errors.notes.message}</p> : null}
            </div>

            {activeError ? (
              <Alert variant="destructive" role="alert">
                <AlertTitle>{alertTitle}</AlertTitle>
                <AlertDescription>{activeError.message}</AlertDescription>
              </Alert>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending || !isDirty}>
              {mutation.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
