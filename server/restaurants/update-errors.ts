/**
 * Known, user-presentable failures of a restaurant profile update. Routes map these to C1
 * responses (`lib/api/errors.ts`); anything else is unexpected and becomes a 500.
 * Messages are fixed copy: never database or provider text, never PII.
 */
export type RestaurantUpdateErrorCode = 'SLUG_TAKEN' | 'VALIDATION_FAILED' | 'RESTAURANT_NOT_FOUND';

const STATUS_BY_CODE: Record<RestaurantUpdateErrorCode, number> = {
  SLUG_TAKEN: 409,
  VALIDATION_FAILED: 400,
  RESTAURANT_NOT_FOUND: 404,
};

export const SLUG_TAKEN_MESSAGE = 'That booking link is already used by another restaurant.';

export class RestaurantUpdateError extends Error {
  readonly code: RestaurantUpdateErrorCode;
  readonly status: number;
  /** Request field (camelCase, as sent to the PATCH route) → messages. */
  readonly fields?: Record<string, string[]>;

  constructor(code: RestaurantUpdateErrorCode, message: string, fields?: Record<string, string[]>) {
    super(message);
    this.name = 'RestaurantUpdateError';
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.fields = fields;
  }
}

export function slugTakenError(): RestaurantUpdateError {
  return new RestaurantUpdateError('SLUG_TAKEN', SLUG_TAKEN_MESSAGE, {
    slug: [SLUG_TAKEN_MESSAGE],
  });
}

export function fieldValidationError(field: string, message: string): RestaurantUpdateError {
  return new RestaurantUpdateError('VALIDATION_FAILED', message, { [field]: [message] });
}

export function isRestaurantUpdateError(error: unknown): error is RestaurantUpdateError {
  return error instanceof RestaurantUpdateError;
}
