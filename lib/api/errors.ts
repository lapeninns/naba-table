import { NextResponse } from 'next/server';

export type ErrorShape = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export function errorResponse(status: number, code: string, message: string, details?: unknown) {
  const body: ErrorShape = { error: { code, message, details } };
  return NextResponse.json(body, { status });
}

export const errors = {
  notFound: (message = 'Route not found') => errorResponse(404, 'NOT_FOUND', message),
  badRequest: (message = 'Bad request', details?: unknown) => errorResponse(400, 'BAD_REQUEST', message, details),
  unauthorized: (message = 'Unauthorized') => errorResponse(401, 'UNAUTHORIZED', message),
  forbidden: (message = 'Forbidden') => errorResponse(403, 'FORBIDDEN', message),
  internal: (message = 'Unexpected error') => errorResponse(500, 'INTERNAL', message),
};

