import { afterEach, describe, expect, it, vi } from 'vitest';

const clearOverrides = () => {
  delete process.env.RESERVE_RESERVATION_OPEN;
  delete process.env.RESERVE_RESERVATION_INTERVAL_MINUTES;
  delete process.env.RESERVE_RESERVATION_DEFAULT_DURATION_MINUTES;
  delete process.env.RESERVE_RESERVATION_TIMEZONE;
  delete process.env.RESERVE_RESERVATION_UNAVAILABLE_TOOLTIP;
};

afterEach(() => {
  clearOverrides();
  vi.resetModules();
});

describe('reservation config', () => {
  it('provides default values when no overrides supplied', async () => {
    const configModule = await import('../reservations');
    expect(configModule.reservationConfigResult.config.opening.open).toBe('12:00');
    expect(configModule.reservationConfigResult.config.opening.intervalMinutes).toBe(30);
    expect(configModule.reservationConfigResult.config.defaultDurationMinutes).toBe(90);
    expect(configModule.reservationConfigResult.issues).toHaveLength(0);
  });

  it('applies overrides and records issues for invalid inputs', async () => {
    process.env.RESERVE_RESERVATION_OPEN = '10:15';
    process.env.RESERVE_RESERVATION_INTERVAL_MINUTES = '20';
    process.env.RESERVE_RESERVATION_DEFAULT_DURATION_MINUTES = '120';

    const configModule = await import('../reservations');

    expect(configModule.reservationConfigResult.config.opening.open).toBe('10:15');
    expect(configModule.reservationConfigResult.config.opening.intervalMinutes).toBe(20);
    expect(configModule.reservationConfigResult.config.defaultDurationMinutes).toBe(120);
    expect(configModule.reservationConfigResult.issues).toHaveLength(0);
  });

  it('falls back to defaults when override is invalid', async () => {
    process.env.RESERVE_RESERVATION_OPEN = 'not-a-time';
    process.env.RESERVE_RESERVATION_INTERVAL_MINUTES = '-5';

    const configModule = await import('../reservations');

    expect(configModule.reservationConfigResult.config.opening.open).toBe('12:00');
    expect(configModule.reservationConfigResult.config.opening.intervalMinutes).toBe(30);
    expect(configModule.reservationConfigResult.issues.length).toBeGreaterThanOrEqual(1);
  });
});
