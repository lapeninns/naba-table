export type BookingCreateRecoveredObservabilityEvent = {
  source: string;
  eventType: 'booking.create.recovered';
  severity: 'warning';
  context: {
    restaurantId: string;
    idempotencyKey?: string;
    method: 'idempotency_key' | 'signature';
  };
};

export type BookingCreateInsertFallbackObservabilityEvent = {
  source: string;
  eventType: 'booking.create.insert_fallback';
  severity: 'warning';
  context: {
    restaurantId: string;
    idempotencyKey?: string;
  };
};

export type BookingCreateRateLimitedObservabilityEvent = {
  source: string;
  eventType: 'booking_creation.rate_limited';
  severity: 'warning';
  context: {
    restaurant_id: string;
    ip_scope: string;
    reset_at: string;
    limit: number;
    window_ms: number;
    rate_source: string;
  };
};

export type BookingPastTimeBlockedObservabilityEvent = {
  source: string;
  eventType: 'booking.past_time.blocked';
  severity: 'warning';
  context: {
    restaurantId: string;
    endpoint: 'bookings.create';
    actorRole: null;
    ipScope: string;
    bookingTime: string;
    serverTime: string;
    timezone: string;
    gracePeriodMinutes: number;
    timeDeltaMinutes: number;
  };
};

export type BookingCapacityPrecheckFailedObservabilityEvent = {
  source: string;
  eventType: 'booking.capacity_precheck.failed';
  severity: 'warning';
  context: {
    restaurantId: string;
    date: string;
    time: string;
    partySize: number;
    error: string;
  };
};

export function buildBookingCreateRateLimitedObservabilityEvent({
  source,
  restaurantId,
  ipScope,
  resetAt,
  limit,
  windowMs,
  rateSource,
}: {
  source: string;
  restaurantId: string;
  ipScope: string;
  resetAt: number;
  limit: number;
  windowMs: number;
  rateSource: string;
}): BookingCreateRateLimitedObservabilityEvent {
  return {
    source,
    eventType: 'booking_creation.rate_limited',
    severity: 'warning',
    context: {
      restaurant_id: restaurantId,
      ip_scope: ipScope,
      reset_at: new Date(resetAt).toISOString(),
      limit,
      window_ms: windowMs,
      rate_source: rateSource,
    },
  };
}

export function buildBookingCapacityPrecheckFailedObservabilityEvent({
  source,
  restaurantId,
  date,
  time,
  partySize,
  error,
}: {
  source: string;
  restaurantId: string;
  date: string;
  time: string;
  partySize: number;
  error: string;
}): BookingCapacityPrecheckFailedObservabilityEvent {
  return {
    source,
    eventType: 'booking.capacity_precheck.failed',
    severity: 'warning',
    context: {
      restaurantId,
      date,
      time,
      partySize,
      error,
    },
  };
}

export function buildBookingPastTimeBlockedObservabilityEvent({
  source,
  restaurantId,
  ipScope,
  details,
}: {
  source: string;
  restaurantId: string;
  ipScope: string;
  details: {
    bookingTime: string;
    serverTime: string;
    timezone: string;
    gracePeriodMinutes: number;
    timeDeltaMinutes: number;
  };
}): BookingPastTimeBlockedObservabilityEvent {
  return {
    source,
    eventType: 'booking.past_time.blocked',
    severity: 'warning',
    context: {
      restaurantId,
      endpoint: 'bookings.create',
      actorRole: null,
      ipScope,
      ...details,
    },
  };
}

export function buildBookingCreateRecoveredObservabilityEvent({
  source,
  restaurantId,
  idempotencyKey,
}: {
  source: string;
  restaurantId: string;
  idempotencyKey: string | null;
}): BookingCreateRecoveredObservabilityEvent {
  return {
    source,
    eventType: 'booking.create.recovered',
    severity: 'warning',
    context: {
      restaurantId,
      idempotencyKey: idempotencyKey ?? undefined,
      method: idempotencyKey ? 'idempotency_key' : 'signature',
    },
  };
}

export function buildBookingCreateInsertFallbackObservabilityEvent({
  source,
  restaurantId,
  idempotencyKey,
}: {
  source: string;
  restaurantId: string;
  idempotencyKey: string | null;
}): BookingCreateInsertFallbackObservabilityEvent {
  return {
    source,
    eventType: 'booking.create.insert_fallback',
    severity: 'warning',
    context: {
      restaurantId,
      idempotencyKey: idempotencyKey ?? undefined,
    },
  };
}
