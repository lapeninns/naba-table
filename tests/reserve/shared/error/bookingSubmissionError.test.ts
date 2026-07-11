import { describe, expect, it } from 'vitest';

import { extractBookingSubmissionError } from '@shared/error/bookingSubmissionError';

describe('extractBookingSubmissionError', () => {
  it('returns the fallback shape for a non-object error @contract', () => {
    expect(extractBookingSubmissionError(undefined)).toEqual({
      code: null,
      message: 'Unable to process booking',
      alternatives: [],
      retryable: false,
      retryAfter: null,
    });
  });

  it('maps a capacity error with direct alternatives @contract @smoke', () => {
    const result = extractBookingSubmissionError({
      code: 'CAPACITY_EXCEEDED',
      alternatives: [
        { time: '18:30', available: true, utilizationPercent: 72 },
        { time: '20:00', available: false, utilizationPercent: '61' },
      ],
      retryable: true,
      retryAfter: '30',
    });

    expect(result.code).toBe('CAPACITY_EXCEEDED');
    expect(result.message).toBe('No tables are available at that time. Please choose another slot.');
    expect(result.alternatives).toEqual([
      { time: '18:30', available: true, utilizationPercent: 72 },
      { time: '20:00', available: false, utilizationPercent: 61 },
    ]);
    expect(result.retryable).toBe(true);
    expect(result.retryAfter).toBe(30);
  });

  it('falls back through errorCode and body.code for the code @contract', () => {
    expect(extractBookingSubmissionError({ errorCode: 'RATE_LIMITED' }).code).toBe('RATE_LIMITED');
    expect(extractBookingSubmissionError({ body: { code: 'INTERNAL' } }).code).toBe('INTERNAL');
    expect(extractBookingSubmissionError({ body: { errorCode: 'SERVICE_PERIOD' } }).code).toBe(
      'SERVICE_PERIOD',
    );
    expect(extractBookingSubmissionError({ message: 'boom' }).code).toBeNull();
  });

  it('prefers direct alternatives over body and details @contract', () => {
    const result = extractBookingSubmissionError({
      alternatives: [{ time: '18:00' }],
      body: { alternatives: [{ time: '19:00' }] },
      details: { alternatives: [{ time: '20:00' }] },
    });
    expect(result.alternatives.map((entry) => entry.time)).toEqual(['18:00']);
  });

  it('falls through to body then details alternatives @contract', () => {
    const fromBody = extractBookingSubmissionError({
      body: { alternatives: [{ time: '19:00' }] },
      details: { alternatives: [{ time: '20:00' }] },
    });
    expect(fromBody.alternatives.map((entry) => entry.time)).toEqual(['19:00']);

    const fromDetails = extractBookingSubmissionError({
      details: { alternatives: [{ time: '20:00' }] },
    });
    expect(fromDetails.alternatives.map((entry) => entry.time)).toEqual(['20:00']);
  });

  it('drops malformed alternative entries and defaults availability to true @contract', () => {
    const result = extractBookingSubmissionError({
      alternatives: [
        'not-a-record',
        { time: '' },
        { time: '18:30' },
        { time: '19:00', available: 'yes', utilizationPercent: 'busy' },
      ],
    });

    expect(result.alternatives).toEqual([
      { time: '18:30', available: true, utilizationPercent: null },
      { time: '19:00', available: true, utilizationPercent: null },
    ]);
  });

  it('reads retry hints from nested payloads @contract', () => {
    expect(extractBookingSubmissionError({ body: { retryable: true } }).retryable).toBe(true);
    expect(extractBookingSubmissionError({ details: { retryable: true } }).retryable).toBe(true);
    expect(extractBookingSubmissionError({ body: { retryAfter: 45 } }).retryAfter).toBe(45);
    expect(extractBookingSubmissionError({ details: { retryAfter: '90' } }).retryAfter).toBe(90);
  });

  it('honors a custom fallback message @contract', () => {
    expect(extractBookingSubmissionError({}, 'Could not update booking').message).toBe(
      'Could not update booking',
    );
  });
});
