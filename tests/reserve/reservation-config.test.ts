import { describe, expect, it } from 'vitest';

import {
  DEFAULT_RESERVATION_INTERVAL_MINUTES,
  defaultReservationConfig,
} from '@reserve/shared/config/reservations';

describe('reservation config defaults', () => {
  it('defaults the reservation interval to 30 minutes', () => {
    expect(DEFAULT_RESERVATION_INTERVAL_MINUTES).toBe(30);
    expect(defaultReservationConfig.opening.intervalMinutes).toBe(30);
  });
});
