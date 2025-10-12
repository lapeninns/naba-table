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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { BookingDTO } from '@/hooks/useBookings';
import { useUpdateBooking } from '@/hooks/useUpdateBooking';
import { isoToLocalInput, localInputToIso } from '@/lib/utils/datetime';
import type { HttpError } from '@/lib/http/errors';
import { emit } from '@/lib/analytics/emit';

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
  UNKNOWN: 'Something went wrong on our side. Please try again.',
};

const schema = z
  .object({
    start: z.string().min(1, 'Select a start time'),
    end: z.string().min(1, 'Select an end time'),
    partySize: z.coerce.number().int().min(1, 'Party size must be at least 1'),
    notes: z.string().max(500, 'Notes must be 500 characters or less').nullable().optional(),
  })
  .superRefine((data, ctx) => {
    const start = localInputToIso(data.start);
    const end = localInputToIso(data.end);
    if (!start || !end) return;
    if (new Date(end).getTime() <= new Date(start).getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'End time must be after start time',
        path: ['end'],
      });
    }
  });

type FormValues = z.infer<typeof schema>;

type UseUpdateBookingHook = () => ReturnType<typeof useUpdateBooking>;

export type EditBookingDialogProps = {
  booking: BookingDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mutationHook?: UseUpdateBookingHook;
};

export function EditBookingDialog({ booking, open, onOpenChange, mutationHook }: EditBookingDialogProps) {
  const defaultValues = useMemo<FormValues>(
    () => ({
      start: isoToLocalInput(booking?.startIso),
      end: isoToLocalInput(booking?.endIso),
      partySize: booking?.partySize ?? 2,
      notes: booking?.notes ?? '',
    }),
    [booking?.endIso, booking?.notes, booking?.partySize, booking?.startIso],
  );

  const resolver = zodResolver(schema) as Resolver<FormValues>;

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver,
    defaultValues,
  });

  const useMutationHook = mutationHook ?? useUpdateBooking;
  const mutation = useMutationHook();
  const [formError, setFormError] = useState<string | null>(null);

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
    const startIso = localInputToIso(values.start);
    const endIso = localInputToIso(values.end);

    if (!startIso || !endIso) {
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
      if (err?.code) {
        const preset = errorCopy[err.code];
        if (preset) {
          setFormError(preset);
          return;
        }
      }
      if (err?.message) {
        setFormError(err.message);
      }
    }
  };

  const mutationError = mutation.error as HttpError | null;
  const serverMessage = formError ?? (mutationError?.code ? errorCopy[mutationError.code] ?? mutationError.message : mutationError?.message);

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
              <Label htmlFor="start">Start</Label>
              <Controller
                name="start"
                control={control}
                render={({ field }) => <Input id="start" type="datetime-local" step="900" {...field} />}
              />
              {errors.start ? <p className="text-sm text-destructive">{errors.start.message}</p> : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="end">End</Label>
              <Controller
                name="end"
                control={control}
                render={({ field }) => <Input id="end" type="datetime-local" step="900" {...field} />}
              />
              {errors.end ? <p className="text-sm text-destructive">{errors.end.message}</p> : null}
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

            {serverMessage ? <p className="text-sm text-destructive" role="alert">{serverMessage}</p> : null}
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
