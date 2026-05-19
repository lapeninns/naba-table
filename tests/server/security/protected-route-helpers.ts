import { NextRequest } from 'next/server';
import { expect, type Mock } from 'vitest';

export const SECURITY_RESTAURANTS = {
  primary: '11111111-1111-4111-8111-111111111111',
  other: '22222222-2222-4222-8222-222222222222',
} as const;

type AppHostRequestOptions = {
  body?: unknown;
  headers?: HeadersInit;
  method?: string;
};

export function appHostRequest(path: string, options: AppHostRequestOptions = {}): NextRequest {
  const headers = new Headers(options.headers);
  const init: RequestInit = {
    headers,
    method: options.method ?? (options.body === undefined ? 'GET' : 'POST'),
  };

  if (options.body !== undefined) {
    if (!headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }
    init.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  }

  return new NextRequest(`https://app.nabatable.com${path}`, init);
}

export function expectNoProtectedSideEffects(mocks: Record<string, Mock>): void {
  for (const [name, mock] of Object.entries(mocks)) {
    expect(mock, `${name} should not be called before authorization passes`).not.toHaveBeenCalled();
  }
}
