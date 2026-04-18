export class GoogleBusinessProfileError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, options?: { code?: string; status?: number }) {
    super(message);
    this.name = 'GoogleBusinessProfileError';
    this.code = options?.code ?? 'GBP_ERROR';
    this.status = options?.status ?? 400;
  }
}

export function isGoogleBusinessProfileError(
  error: unknown,
): error is GoogleBusinessProfileError {
  return error instanceof GoogleBusinessProfileError;
}
