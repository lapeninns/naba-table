'use client';

import { CalendarClock, Loader2, UserRound } from 'lucide-react';
import { DateTime } from 'luxon';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { ScheduleAwareTimestampPicker } from '@/components/features/booking-state-machine';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { FormRoot } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useOpsActiveMembership, useOpsSession } from '@/contexts/ops-session';
import { useOpsRestaurantDetails } from '@/hooks';
import { fetchJson } from '@/lib/http/fetchJson';
import { opsHref } from '@/lib/url/opsHref';

type BookingType = 'lunch' | 'dinner';

type CreateBookingResponse = {
  booking?: {
    id?: string;
  };
};

function inferBookingTypeFromIso(startIso: string | null, timezone: string): BookingType {
  if (!startIso) {
    return 'dinner';
  }
  const local = DateTime.fromISO(startIso, { zone: 'utc' }).setZone(timezone);
  if (!local.isValid) {
    return 'dinner';
  }
  return local.hour < 16 ? 'lunch' : 'dinner';
}

export function WalkInWizardClient() {
  const router = useRouter();
  const { memberships, activeRestaurantId } = useOpsSession();
  const activeMembership = useOpsActiveMembership();
  const restaurantQuery = useOpsRestaurantDetails(activeRestaurantId ?? undefined);

  const searchParams = useSearchParams();

  const profile = restaurantQuery.data;
  const restaurantTimezone = profile?.timezone || 'UTC';
  const restaurantSlug = activeMembership?.restaurantSlug ?? null;
  const initialPartySize = useMemo(() => {
    const partyParam = Number(searchParams.get('partySize'));
    return Number.isFinite(partyParam) && partyParam > 0 ? Math.round(partyParam) : 2;
  }, [searchParams]);
  const [startIso, setStartIso] = useState<string | null>(null);
  const [dateIso, setDateIso] = useState<string | null>(searchParams.get('date'));
  const [partySize, setPartySize] = useState(initialPartySize);
  const [bookingType, setBookingType] = useState<BookingType>('dinner');
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<{
    tone: 'success' | 'error' | 'info';
    title: string;
    message: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const dateParam = searchParams.get('date');
    const timeParam = searchParams.get('time');
    if (!dateParam || !timeParam || startIso) {
      return;
    }

    const initial = DateTime.fromISO(`${dateParam}T${timeParam}`, { zone: restaurantTimezone });
    if (initial.isValid) {
      setStartIso(initial.toUTC().toISO());
      setDateIso(dateParam);
    }
  }, [restaurantTimezone, searchParams, startIso]);

  useEffect(() => {
    setBookingType((current) => current || inferBookingTypeFromIso(startIso, restaurantTimezone));
  }, [restaurantTimezone, startIso]);

  const canSubmit = Boolean(activeRestaurantId && startIso && guestName.trim().length >= 2);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!activeRestaurantId) {
      setStatus({
        tone: 'error',
        title: 'Restaurant required',
        message: 'Choose a restaurant before creating a booking.',
      });
      return;
    }
    if (!startIso) {
      setStatus({
        tone: 'error',
        title: 'Time required',
        message: 'Choose a date and time before creating the booking.',
      });
      return;
    }
    if (guestName.trim().length < 2) {
      setStatus({
        tone: 'error',
        title: 'Guest name required',
        message: 'Enter at least two characters for the guest name.',
      });
      return;
    }
    if (!guestEmail.trim() && !guestPhone.trim()) {
      setStatus({
        tone: 'error',
        title: 'Contact required',
        message: 'Add an email address or phone number for the booking.',
      });
      return;
    }

    const localStart = DateTime.fromISO(startIso, { zone: 'utc' }).setZone(restaurantTimezone);
    const bookingDate = localStart.toISODate();
    const bookingTime = localStart.toFormat('HH:mm');
    if (!localStart.isValid || !bookingDate || !bookingTime) {
      setStatus({
        tone: 'error',
        title: 'Invalid time',
        message: 'Choose a valid booking time.',
      });
      return;
    }

    setIsSubmitting(true);
    setStatus({ tone: 'info', title: 'Creating booking', message: 'Saving this booking now.' });

    try {
      await fetchJson<CreateBookingResponse>('/api/ops/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key':
            typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        },
        body: JSON.stringify({
          restaurantId: activeRestaurantId,
          date: bookingDate,
          time: bookingTime,
          party: partySize,
          bookingType,
          seating: 'any',
          notes: notes.trim() ? notes.trim() : null,
          name: guestName.trim(),
          email: guestEmail.trim() || null,
          phone: guestPhone.trim() || null,
          marketingOptIn: false,
        }),
      });

      setStatus({
        tone: 'success',
        title: 'Booking created',
        message: 'Returning to the booking queue.',
      });
      router.push(opsHref('/bookings'));
    } catch (error) {
      setStatus({
        tone: 'error',
        title: 'Unable to create booking',
        message: error instanceof Error ? error.message : 'Try again in a moment.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusVariant =
    status?.tone === 'error' ? 'destructive' : status?.tone === 'success' ? 'success' : 'info';

  const resolvedStartLabel = useMemo(() => {
    if (!startIso) {
      return 'No time selected';
    }
    const localStart = DateTime.fromISO(startIso, { zone: 'utc' }).setZone(restaurantTimezone);
    if (!localStart.isValid) {
      return 'Invalid time';
    }
    return localStart.toFormat('ccc d LLL, HH:mm');
  }, [restaurantTimezone, startIso]);

  const bookingTypeLabel = bookingType === 'lunch' ? 'Lunch' : 'Dinner';

  const updatePartySize = (direction: 'decrement' | 'increment') => {
    setPartySize((current) => {
      if (direction === 'decrement') {
        return Math.max(1, current - 1);
      }
      return Math.min(30, current + 1);
    });
  };

  const handleStartChange = (next: string | null) => {
    setStartIso(next);
    setBookingType(inferBookingTypeFromIso(next, restaurantTimezone));
  };

  const currentRestaurantName =
    profile?.name ?? activeMembership?.restaurantName ?? 'This restaurant';

  const isPreparingContext =
    !activeMembership ||
    !activeRestaurantId ||
    (restaurantQuery.isLoading && !restaurantQuery.data);

  const pickerMinDate = useMemo(
    () => (dateIso ? DateTime.fromISO(dateIso).toJSDate() : new Date()),
    [dateIso],
  );

  if (memberships.length === 0) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Access required</AlertTitle>
        <AlertDescription className="flex flex-col gap-2">
          You need a restaurant membership before logging walk-ins.
          <Button asChild size="sm" variant="secondary" className="w-fit">
            <Link href={opsHref('/bookings')}>Back to bookings</Link>
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!activeMembership || !activeRestaurantId) {
    return (
      <Card className="flex min-h-[40vh] flex-col items-center justify-center gap-3 border-dashed text-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">Preparing your restaurant context…</p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-md">
              {currentRestaurantName}
            </Badge>
            <Badge variant="outline" className="rounded-md">
              {bookingTypeLabel}
            </Badge>
          </div>
          <div>
            <CardTitle>Create a new booking</CardTitle>
            <CardDescription>
              Capture the booking details, contact method, and service time from the Ops surface.
            </CardDescription>
          </div>
          {restaurantQuery.isError ? (
            <Alert variant="warning">
              <AlertTitle>Limited fallback mode</AlertTitle>
              <AlertDescription>
                Restaurant profile metadata could not be loaded. You can still create a booking, but
                timezone and duration data may be incomplete.
              </AlertDescription>
            </Alert>
          ) : null}
        </CardHeader>
      </Card>

      <FormRoot className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarClock className="size-4 text-muted-foreground" aria-hidden />
                Service time
              </CardTitle>
              <CardDescription>
                Choose the date, party size, and time. Availability rules are checked before save.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isPreparingContext ? (
                <div
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                  role="status"
                >
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  Loading restaurant details…
                </div>
              ) : (
                <ScheduleAwareTimestampPicker
                  restaurantSlug={restaurantSlug}
                  restaurantTimezone={restaurantTimezone}
                  value={startIso}
                  onChange={handleStartChange}
                  onDateChange={setDateIso}
                  minDate={pickerMinDate}
                  label="Booking slot"
                  description="Pick a service date and time for this booking."
                >
                  <div className="flex flex-col gap-3">
                    <Label>Party size</Label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => updatePartySize('decrement')}
                        disabled={partySize <= 1}
                        aria-label="Decrease party size"
                      >
                        -
                      </Button>
                      <div className="flex h-10 min-w-24 items-center justify-center rounded-md border bg-background px-3 text-sm font-medium">
                        {partySize} {partySize === 1 ? 'guest' : 'guests'}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => updatePartySize('increment')}
                        disabled={partySize >= 30}
                        aria-label="Increase party size"
                      >
                        +
                      </Button>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="booking-type">Service</Label>
                      <Select
                        value={bookingType}
                        onValueChange={(value) => setBookingType(value as BookingType)}
                      >
                        <SelectTrigger id="booking-type">
                          <SelectValue placeholder="Choose service" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="lunch">Lunch</SelectItem>
                          <SelectItem value="dinner">Dinner</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </ScheduleAwareTimestampPicker>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UserRound className="size-4 text-muted-foreground" aria-hidden />
                Guest details
              </CardTitle>
              <CardDescription>
                Add the guest name and at least one contact method for confirmation updates.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="guest-name">Guest name</Label>
                <Input
                  id="guest-name"
                  value={guestName}
                  onChange={(event) => setGuestName(event.target.value)}
                  autoComplete="name"
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="guest-email">Email</Label>
                <Input
                  id="guest-email"
                  type="email"
                  value={guestEmail}
                  onChange={(event) => setGuestEmail(event.target.value)}
                  autoComplete="email"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="guest-phone">Phone</Label>
                <Input
                  id="guest-phone"
                  type="tel"
                  value={guestPhone}
                  onChange={(event) => setGuestPhone(event.target.value)}
                  autoComplete="tel"
                />
              </div>
              <div className="flex flex-col gap-2 sm:col-span-2">
                <Label htmlFor="booking-notes">Notes</Label>
                <Textarea
                  id="booking-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  maxLength={500}
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit lg:sticky lg:top-20">
          <CardHeader>
            <CardTitle className="text-base">Review</CardTitle>
            <CardDescription>Check the booking before saving it.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Restaurant</span>
              <span className="text-right font-medium">{currentRestaurantName}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Time</span>
              <span className="text-right font-medium">{resolvedStartLabel}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Party</span>
              <span className="text-right font-medium">{partySize}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Guest</span>
              <span className="text-right font-medium">{guestName || 'Not entered'}</span>
            </div>
            {status ? (
              <Alert variant={statusVariant}>
                <AlertTitle>{status.title}</AlertTitle>
                <AlertDescription>{status.message}</AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
          <CardFooter className="flex flex-col gap-2">
            <Button type="submit" className="w-full" disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? 'Creating…' : 'Create booking'}
            </Button>
            <Button asChild type="button" variant="outline" className="w-full">
              <Link href={opsHref('/bookings')}>Cancel</Link>
            </Button>
          </CardFooter>
        </Card>
      </FormRoot>
    </div>
  );
}
