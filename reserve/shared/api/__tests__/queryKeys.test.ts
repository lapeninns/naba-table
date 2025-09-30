import { describe, expect, it } from 'vitest';

import { reservationKeys } from '../queryKeys';

describe('reservationKeys', () => {
  it('returns a stable list key', () => {
    expect(reservationKeys.all()).toEqual(['reservations']);
    expect(reservationKeys.all()).toBe(reservationKeys.all());
  });

  it('creates detail keys scoped by reservation id', () => {
    expect(reservationKeys.detail('abc-123')).toEqual(['reservation', 'abc-123']);
  });

  it('uses null placeholder when id is missing', () => {
    expect(reservationKeys.detail(undefined)).toEqual(['reservation', null]);
    expect(reservationKeys.detail(null)).toEqual(['reservation', null]);
  });
});
