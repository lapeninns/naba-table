import type { z } from 'zod';

export type BookingZodValidationFailure = {
  status: 400;
  body: {
    error: string;
    code: 'VALIDATION_FAILED';
    details: ReturnType<z.ZodError['flatten']>;
  };
};

export function mapBookingZodValidationFailure(error: z.ZodError): BookingZodValidationFailure {
  const flattened = error.flatten();
  const firstField = Object.keys(flattened.fieldErrors)[0];
  const firstErrorMessage = firstField
    ? `${firstField}: ${(flattened.fieldErrors as Record<string, string[] | undefined>)[firstField]?.[0]}`
    : 'Invalid payload';

  return {
    status: 400,
    body: {
      error: `Validation failed - ${firstErrorMessage}`,
      code: 'VALIDATION_FAILED',
      details: flattened,
    },
  };
}
