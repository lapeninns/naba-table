export const GOOGLE_PROVIDER_ERROR_KINDS = [
  'reauth',
  'access_lost',
  'not_found',
  'conflict',
  'quota',
  'timeout',
  'malformed_response',
  'upstream',
] as const;

export type GoogleProviderErrorKind = (typeof GOOGLE_PROVIDER_ERROR_KINDS)[number];

export class GoogleBusinessProfileError extends Error {
  readonly code: string;
  readonly status: number;
  readonly kind?: GoogleProviderErrorKind;
  readonly upstreamStatus?: number;
  readonly upstreamReason?: string;
  readonly requestId?: string;

  constructor(
    message: string,
    options: {
      readonly code?: string;
      readonly status?: number;
      readonly kind?: GoogleProviderErrorKind;
      readonly upstreamStatus?: number;
      readonly upstreamReason?: string;
      readonly requestId?: string;
    } = {},
  ) {
    super(message);
    this.name = 'GoogleBusinessProfileError';
    this.code = options.code ?? 'GBP_ERROR';
    this.status = options.status ?? 400;
    this.kind = options.kind;
    this.upstreamStatus = options.upstreamStatus;
    this.upstreamReason = options.upstreamReason;
    this.requestId = options.requestId;
  }
}

export function isGoogleBusinessProfileError(error: unknown): error is GoogleBusinessProfileError {
  return error instanceof GoogleBusinessProfileError;
}
