'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { RestaurantDetailsForm, type RestaurantDetailsFormValues } from '@/components/ops/restaurants/RestaurantDetailsForm';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card } from '@/components/ui/card';
import { HttpError } from '@/lib/http/errors';
import { fetchJson } from '@/lib/http/fetchJson';
import { getBrowserCsrfToken } from '@/lib/security/csrf';

type Props = {
  restaurantId?: string | null;
};

type RestaurantResponse = {
  restaurant: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
    capacity: number | null;
    contactEmail: string | null;
    contactPhone: string | null;
    address: string | null;
    googleMapUrl: string | null;
    bookingPolicy: string | null;
    emailSendReminder24h: boolean;
    emailSendReminderShort: boolean;
    emailSendReviewRequest: boolean;
    reservationIntervalMinutes: number;
    reservationDefaultDurationMinutes: number;
    reservationLastSeatingBufferMinutes: number;
  };
};

const EMPTY_VALUES: RestaurantDetailsFormValues = {
  name: '',
  slug: '',
  timezone: 'Europe/London',
  contactEmail: '',
  contactPhone: '',
  address: '',
  googleMapUrl: '',
  bookingPolicy: '',
  reservationIntervalMinutes: 15,
  reservationDefaultDurationMinutes: 90,
  reservationLastSeatingBufferMinutes: 120,
  emailSendReminder24h: true,
  emailSendReminderShort: true,
  emailSendReviewRequest: true,
};

export function ProfileClient({ restaurantId }: Props) {
  const router = useRouter();
  const [initialValues, setInitialValues] = useState<RestaurantDetailsFormValues>(EMPTY_VALUES);
  const [loading, setLoading] = useState(Boolean(restaurantId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function fetchProfile(id: string) {
      setLoading(true);
      setError(null);
      try {
        const response = await fetchJson<RestaurantResponse>(`/api/ops/restaurants/${id}`);
        if (!active) return;
        const r = response.restaurant;
        setInitialValues({
          name: r.name ?? '',
          slug: r.slug ?? '',
          timezone: r.timezone ?? 'Europe/London',
          contactEmail: r.contactEmail ?? '',
          contactPhone: r.contactPhone ?? '',
          address: r.address ?? '',
          googleMapUrl: r.googleMapUrl ?? '',
          bookingPolicy: r.bookingPolicy ?? '',
          reservationIntervalMinutes: r.reservationIntervalMinutes ?? 15,
          reservationDefaultDurationMinutes: r.reservationDefaultDurationMinutes ?? 90,
          reservationLastSeatingBufferMinutes: r.reservationLastSeatingBufferMinutes ?? 120,
          emailSendReminder24h: r.emailSendReminder24h ?? true,
          emailSendReminderShort: r.emailSendReminderShort ?? true,
          emailSendReviewRequest: r.emailSendReviewRequest ?? true,
        });
      } catch (err) {
        if (!active) return;
        setError(err instanceof HttpError ? err.message : 'Failed to load restaurant profile');
      } finally {
        if (active) setLoading(false);
      }
    }
    if (restaurantId) {
      void fetchProfile(restaurantId);
    } else {
      setInitialValues(EMPTY_VALUES);
      setLoading(false);
      setError(null);
    }
    return () => {
      active = false;
    };
  }, [restaurantId]);

  const csrf = useMemo(() => getBrowserCsrfToken(), []);

  const handleSubmit = async (values: RestaurantDetailsFormValues) => {
    setError(null);
    try {
      if (restaurantId) {
        await fetchJson<RestaurantResponse>(`/api/ops/restaurants/${restaurantId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(csrf ? { 'x-csrf-token': csrf } : {}),
          },
          body: JSON.stringify(values),
        });
        router.push(`/onboarding/hours?rid=${restaurantId}`);
        return;
      }

      const response = await fetchJson<RestaurantResponse>('/api/onboarding/restaurant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrf ? { 'x-csrf-token': csrf } : {}),
        },
        body: JSON.stringify(values),
      });
      const id = response.restaurant.id;
      router.push(`/onboarding/hours?rid=${id}`);
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Unable to save restaurant');
    }
  };

  return (
    <div className="space-y-4">
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not save profile</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Card className="border-border/70 bg-card/90 p-6 shadow-sm">
        <RestaurantDetailsForm initialValues={initialValues} onSubmit={handleSubmit} isSubmitting={loading} submitLabel="Save & continue" />
      </Card>
    </div>
  );
}
