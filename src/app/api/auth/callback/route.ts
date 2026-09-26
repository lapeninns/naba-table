import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import config from '@/config';
import {
  defaultRedirectForHost,
  sanitizeRedirect,
  toAbsoluteRedirectTarget,
} from '@/lib/auth/redirects';
import { logger } from '@/lib/logger';
import { getTrustedAppOrigin, getTrustedSiteOrigin } from '@/lib/site-url';
import { normalizeEmail } from '@/server/customers';
import { getRouteHandlerSupabaseClient, getServiceSupabaseClient } from '@/server/supabase';

import type { NextRequest } from 'next/server';

const ROUTE = '/api/auth/callback';

export const dynamic = 'force-dynamic';

const INVALID_CLIENT_ID_ERROR_TYPE = 'invalid_client_id';
const INVALID_CLIENT_ID_USER_MESSAGE =
  'Sign-in is temporarily unavailable due to an authentication provider setup issue. Please contact support or try again later.';

function describeRedirectTarget(value: string | null): string {
  if (!value) return 'none';
  if (value.startsWith('/')) return 'relative';
  try {
    return `absolute:${new URL(value).hostname.toLowerCase()}`;
  } catch {
    return 'invalid';
  }
}

function normalizeRootDomain(rootDomain: string): string {
  return rootDomain.toLowerCase().replace(/^www\./, '');
}

function resolveTrustedCallbackOrigin(
  hostname: string,
  rootDomain: string,
  requestOrigin: string,
): string {
  const normalizedHost = hostname.toLowerCase();
  const normalizedRoot = normalizeRootDomain(rootDomain);
  const localHosts = new Set(['localhost', '127.0.0.1', 'app.localhost', 'www.localhost']);

  if (rootDomain === 'localhost' && localHosts.has(normalizedHost)) {
    return requestOrigin;
  }

  if (normalizedHost === `app.${normalizedRoot}`) {
    return getTrustedAppOrigin();
  }

  return getTrustedSiteOrigin();
}

function isInvalidClientIdError(error: {
  message?: string | null;
  code?: string | null;
  name?: string | null;
}): boolean {
  const parts = [error.code, error.name, error.message].filter(
    (part): part is string => typeof part === 'string',
  );

  const message = error.message;
  if (typeof message === 'string') {
    try {
      const decodedMessage = decodeURIComponent(message);
      if (decodedMessage !== message) {
        parts.push(decodedMessage);
      }
    } catch {
      // Ignore decode errors and continue with raw value.
    }

    try {
      const parsed = JSON.parse(message) as {
        error?: string;
        error_description?: string;
        message?: string;
      };
      if (parsed.error) parts.push(parsed.error);
      if (parsed.error_description) parts.push(parsed.error_description);
      if (parsed.message) parts.push(parsed.message);
    } catch {
      try {
        const parsed = JSON.parse(decodeURIComponent(message)) as {
          error?: string;
          error_description?: string;
          message?: string;
        };
        if (parsed.error) parts.push(parsed.error);
        if (parsed.error_description) parts.push(parsed.error_description);
        if (parsed.message) parts.push(parsed.message);
      } catch {
        // Ignore parse errors and rely on raw message matching.
      }
    }
  }

  const normalized = parts.join(' ').toLowerCase();
  return (
    normalized.includes('invalid_client_id') ||
    normalized.includes('invalid client_id parameter value')
  );
}

async function linkAuthUserToCustomers(authUserId: string, email: string): Promise<void> {
  try {
    const serviceClient = getServiceSupabaseClient();
    const normalizedEmail = normalizeEmail(email);

    const { data: customers, error: findError } = await serviceClient
      .from('customers')
      .select('id')
      .eq('email_normalized', normalizedEmail)
      .is('auth_user_id', null);

    if (findError) {
      logger.error('[auth/callback] Failed to find customers for linking:', {
        route: ROUTE,
        error: findError.message,
      });
      return;
    }

    if (!customers?.length) {
      return;
    }

    const customerIds = customers.map((c) => c.id);
    const { error: updateError } = await serviceClient
      .from('customers')
      .update({ auth_user_id: authUserId })
      .in('id', customerIds);

    if (updateError) {
      logger.error('[auth/callback] Failed to link customers to auth user:', {
        route: ROUTE,
        error: updateError.message,
      });
      return;
    }
  } catch (error) {
    logger.error('[auth/callback] Error linking auth user to customers:', { route: ROUTE, error });
  }
}

// This route is called after a successful login. It exchanges the code for a session and redirects to the callback URL (see config.js).
export async function GET(req: NextRequest) {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get('code');
  const tokenHash = requestUrl.searchParams.get('token_hash');
  const redirectedFrom = requestUrl.searchParams.get('redirectedFrom');
  const hostname = requestUrl.hostname.toLowerCase();
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost';
  const hasAuthParams = !!code || !!tokenHash;

  const resolveDestination = () => {
    const sanitized = sanitizeRedirect(redirectedFrom, rootDomain, hostname);
    if (!sanitized) {
      if (redirectedFrom) {
        logger.warn('[auth/callback] rejected redirect param', {
          route: ROUTE,
          redirectedFrom: describeRedirectTarget(redirectedFrom),
        });
      }
      // Use host-aware default redirect: app subdomain -> /dashboard, root domain -> /guest/dashboard
      return defaultRedirectForHost(hostname, rootDomain);
    }
    return sanitized;
  };

  // Resolve destination URL first so we can create redirect response
  const buildLoginRedirect = (errorType: string, userMessage: string) => {
    const loginUrl = new URL(
      config.auth.loginUrl,
      resolveTrustedCallbackOrigin(hostname, rootDomain, requestUrl.origin),
    );
    loginUrl.searchParams.set('error', errorType);
    loginUrl.searchParams.set('message', userMessage);
    return NextResponse.redirect(loginUrl.toString());
  };

  if (!hasAuthParams) {
    logger.warn(
      '[auth/callback] No code or token_hash parameter in request - possible direct access or malformed link',
      { route: ROUTE, redirectedFrom: describeRedirectTarget(redirectedFrom) },
    );
    return buildLoginRedirect(
      'missing_auth_parameters',
      'Authentication callback was missing required parameters. Please try signing in again.',
    );
  }

  const destination = toAbsoluteRedirectTarget(resolveDestination(), rootDomain);
  const redirectUrl = new URL(
    destination,
    resolveTrustedCallbackOrigin(hostname, rootDomain, requestUrl.origin),
  );

  const cookieStore = await cookies();

  if (code || tokenHash) {
    // Create Supabase client that writes cookies to the cookie store
    const supabase = await getRouteHandlerSupabaseClient(cookieStore);

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        logger.error('[auth/callback] Session exchange failed:', {
          route: ROUTE,
          message: error.message,
          status: error.status,
          errorKind: error.code,
          name: error.name,
        });

        // Provide more specific error messages based on error type
        let userMessage = 'Authentication link has expired or is invalid. Please try again.';
        let errorType = 'auth_failed';

        if (isInvalidClientIdError(error)) {
          userMessage = INVALID_CLIENT_ID_USER_MESSAGE;
          errorType = INVALID_CLIENT_ID_ERROR_TYPE;
        } else if (error.message?.includes('expired') || error.code === 'otp_expired') {
          userMessage = 'Your magic link has expired. Please request a new one.';
          errorType = 'link_expired';
        } else if (error.message?.includes('already been used') || error.code === 'otp_disabled') {
          userMessage = 'This magic link has already been used. Please request a new one.';
          errorType = 'link_used';
        } else if (error.message?.includes('code verifier') || error.code === 'bad_code_verifier') {
          userMessage =
            'Authentication failed. Please use the same browser where you requested the magic link.';
          errorType = 'pkce_mismatch';
          logger.error(
            '[auth/callback] PKCE code verifier mismatch - user may have opened link in different browser',
            { route: ROUTE },
          );
        }

        return buildLoginRedirect(errorType, userMessage);
      }

      const userData = await supabase.auth.getUser();
      const verifiedUser = userData.data.user;
      if (verifiedUser?.email) {
        await linkAuthUserToCustomers(verifiedUser.id, verifiedUser.email);
      }
    } else if (tokenHash) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: 'magiclink',
      });

      if (error) {
        logger.error('[auth/callback] token_hash verification failed:', {
          route: ROUTE,
          message: error.message,
          status: error.status,
          errorKind: error.code,
          name: error.name,
        });

        // Provide more specific error messages based on error type
        let userMessage = 'Authentication link has expired or is invalid. Please try again.';
        let errorType = 'auth_failed';

        if (isInvalidClientIdError(error)) {
          userMessage = INVALID_CLIENT_ID_USER_MESSAGE;
          errorType = INVALID_CLIENT_ID_ERROR_TYPE;
        } else if (error.message?.includes('expired') || error.code === 'otp_expired') {
          userMessage = 'Your magic link has expired. Please request a new one.';
          errorType = 'link_expired';
        } else if (error.message?.includes('already been used') || error.code === 'otp_disabled') {
          userMessage = 'This magic link has already been used. Please request a new one.';
          errorType = 'link_used';
        }

        return buildLoginRedirect(errorType, userMessage);
      }

      const userData = await supabase.auth.getUser();
      const verifiedUser = userData.data.user;
      if (verifiedUser?.email) {
        await linkAuthUserToCustomers(verifiedUser.id, verifiedUser.email);
      }
    }
  }

  return NextResponse.redirect(redirectUrl.toString());
}
