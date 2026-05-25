import { env } from '@/lib/env';

import { GoogleBusinessProfileError } from './errors';

export async function googleFetchJson<T>(
  url: string,
  accessToken: string,
  init?: RequestInit,
): Promise<T> {
  const quotaProject = env.googleBusinessProfile.quotaProject;
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(quotaProject ? { 'X-Goog-User-Project': quotaProject } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new GoogleBusinessProfileError(
        'Google authorization failed while fetching Business Profile data.',
        {
          code: 'GBP_FORBIDDEN',
          status: 409,
        },
      );
    }

    throw new GoogleBusinessProfileError('Google Business Profile request failed unexpectedly.', {
      code: 'GBP_UPSTREAM_ERROR',
      status: 502,
    });
  }

  const text = await response.text();
  if (!text.trim()) {
    return {} as T;
  }

  return JSON.parse(text) as T;
}
