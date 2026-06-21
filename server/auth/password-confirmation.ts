import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';


import { env } from '@/lib/env';
import { consumeRateLimit } from '@/server/security/rate-limit';

import type { Database } from '@/types/supabase';

export class PasswordConfirmationError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(
    message: string,
    options: {
      code?: string;
      status?: number;
    } = {},
  ) {
    super(message);
    this.name = 'PasswordConfirmationError';
    this.code = options.code ?? 'PASSWORD_CONFIRMATION_FAILED';
    this.status = options.status ?? 403;
  }
}

const PASSWORD_CONFIRMATION_LIMIT = 5;
const PASSWORD_CONFIRMATION_WINDOW_MS = 10 * 60 * 1000;

function hashRateLimitSubject(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 32);
}

function createStatelessSupabaseAuthClient() {
  return createClient<Database>(env.supabase.url, env.supabase.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export async function verifyUserPasswordConfirmation(params: {
  email: string | null | undefined;
  password: string;
}): Promise<void> {
  const email = typeof params.email === 'string' ? params.email.trim().toLowerCase() : '';
  const password = params.password;

  if (!email) {
    throw new PasswordConfirmationError(
      'Your account email could not be resolved for password confirmation.',
      {
        code: 'PASSWORD_CONFIRMATION_EMAIL_UNAVAILABLE',
        status: 409,
      },
    );
  }

  if (!password) {
    throw new PasswordConfirmationError('Enter your password to confirm this GBP action.', {
      code: 'PASSWORD_CONFIRMATION_REQUIRED',
      status: 400,
    });
  }

  try {
    const rateLimit = await consumeRateLimit({
      identifier: `auth:password-confirmation:${hashRateLimitSubject(email)}`,
      limit: PASSWORD_CONFIRMATION_LIMIT,
      windowMs: PASSWORD_CONFIRMATION_WINDOW_MS,
    });

    if (!rateLimit.ok) {
      throw new PasswordConfirmationError(
        'Too many password confirmation attempts. Please try again later.',
        {
          code: 'PASSWORD_CONFIRMATION_RATE_LIMITED',
          status: 429,
        },
      );
    }
  } catch (error) {
    if (error instanceof PasswordConfirmationError) {
      throw error;
    }
    throw new PasswordConfirmationError('Password confirmation is temporarily unavailable.', {
      code: 'PASSWORD_CONFIRMATION_RATE_LIMIT_UNAVAILABLE',
      status: 503,
    });
  }

  const supabase = createStatelessSupabaseAuthClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  try {
    // Sign out only the temporary confirmation session. Supabase defaults to global sign-out,
    // which would revoke the user's active dashboard sessions as well.
    await supabase.auth.signOut({ scope: 'local' });
  } catch {
    // Best effort only; this stateless client does not persist browser session state.
  }

  if (error) {
    throw new PasswordConfirmationError(
      'Incorrect password. Confirm the change with your login password and try again.',
      {
        code: 'PASSWORD_CONFIRMATION_FAILED',
        status: 403,
      },
    );
  }
}
