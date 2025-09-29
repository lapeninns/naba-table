export interface HttpErrorInit {
  message: string;
  status: number;
  code?: string;
  details?: unknown;
  cause?: unknown;
}

export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor({ message, status, code, details, cause }: HttpErrorInit) {
    super(message, { cause });
    this.name = 'HttpError';
    this.status = status;
    this.code = code ?? `HTTP_${status}`;
    this.details = details;
  }
}

export type ErrorLikeBody = {
  message?: unknown;
  status?: unknown;
  code?: unknown;
  details?: unknown;
};

export function normalizeError({
  status,
  statusText,
  body,
  cause,
}: {
  status: number;
  statusText?: string;
  body?: ErrorLikeBody | null;
  cause?: unknown;
}): HttpError {
  const parsedMessage =
    typeof body?.message === 'string' && body.message.trim().length > 0
      ? body.message.trim()
      : statusText && statusText.trim().length > 0
        ? statusText
        : `Request failed with status ${status}`;

  const parsedCode =
    typeof body?.code === 'string' && body.code.trim().length > 0
      ? body.code.trim()
      : `HTTP_${status}`;

  return new HttpError({
    message: parsedMessage,
    status,
    code: parsedCode,
    details: body?.details,
    cause,
  });
}
