import { AlertCircle, ArrowRight, BarChart3, Calendar, Shield, Users } from 'lucide-react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { OpsSignInForm } from '@/components/auth/OpsSignInForm';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { hasRedirectedFrom } from '@/lib/auth/signin-redirect-guard';
import { sanitizeLocalRedirectPath } from '@/lib/url/safe-local-path';
import { ensureCsrfCookie } from '@/server/security/csrf';
import { getServerComponentSupabaseClient } from '@/server/supabase';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign in to operations · Nab a Table',
  description: 'Access the restaurant operations console to manage bookings and your team.',
};

export const dynamic = 'force-dynamic';

type OpsLoginSearchParams = {
  redirectedFrom?: string | string[];
  error?: string;
  message?: string;
};

type OpsLoginPageProps = {
  searchParams: Promise<OpsLoginSearchParams>;
};

const ALLOWED_REDIRECT_PREFIXES = [
  '/app',
  '/guest',
  '/restaurants',
  '/dashboard',
  '/bookings',
  '/customers',
  '/settings',
  '/new-bookings',
] as const;

function resolveRedirectTarget(raw: string | string[] | undefined): string {
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  return sanitizeLocalRedirectPath(candidate, {
    fallback: '/app',
    allowedPrefixes: ALLOWED_REDIRECT_PREFIXES,
  });
}

const INVALID_CLIENT_ID_SAFE_MESSAGE =
  'Sign-in is temporarily unavailable due to an authentication provider setup issue. Please contact support or try again later.';

const OPS_SIGNIN_FEATURES = [
  {
    title: 'Real-time bookings',
    description: 'Manage all reservations with live updates',
    icon: Calendar,
  },
  {
    title: 'Powerful analytics',
    description: 'Track covers, peak hours, and revenue trends',
    icon: BarChart3,
  },
  {
    title: 'Team collaboration',
    description: 'Role-based access with activity logs',
    icon: Users,
  },
] as const;

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeAuthMessage(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const decoded = safeDecodeURIComponent(raw).trim();
  const parts = [decoded];

  if (decoded.startsWith('{') && decoded.endsWith('}')) {
    try {
      const parsed = JSON.parse(decoded) as {
        error?: string;
        error_description?: string;
        message?: string;
      };
      if (typeof parsed.error === 'string') parts.push(parsed.error);
      if (typeof parsed.error_description === 'string') parts.push(parsed.error_description);
      if (typeof parsed.message === 'string') parts.push(parsed.message);
    } catch {
      // Keep decoded value when payload is not valid JSON.
    }
  }

  const normalized = parts.join(' ').toLowerCase();
  if (
    normalized.includes('invalid_client_id') ||
    normalized.includes('invalid client_id parameter value')
  ) {
    return INVALID_CLIENT_ID_SAFE_MESSAGE;
  }

  return decoded;
}

export default async function OpsAuthSignInPage({ searchParams }: OpsLoginPageProps) {
  await ensureCsrfCookie();

  const resolvedParams = await searchParams;
  const cameFromAuthGuard = hasRedirectedFrom(resolvedParams?.redirectedFrom);
  const redirectTarget = resolveRedirectTarget(resolvedParams?.redirectedFrom);

  // Build guest sign-in URL for cross-subdomain navigation
  const headersList = await headers();
  const hostHeader = headersList.get('host') ?? '';
  const hostPort = hostHeader.includes(':') ? hostHeader.split(':').pop() : undefined;
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'localhost';
  const guestSignInUrl =
    rootDomain === 'localhost'
      ? `http://localhost${hostPort ? `:${hostPort}` : ''}/auth/signin`
      : `https://${rootDomain.toLowerCase().replace(/^www\./, '')}/auth/signin`;

  // Extract error info from URL params
  const errorType = resolvedParams?.error;
  const errorMessage = normalizeAuthMessage(resolvedParams?.message);
  const hasError = !!errorType;

  // Only redirect authenticated users if there's no error
  // Using getUser() which validates the JWT with the server, not just reads cached session
  // This prevents redirect loops after logout since getSession() returns stale cached data
  if (!hasError && !cameFromAuthGuard) {
    const supabase = await getServerComponentSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    // Only redirect if we have a valid user AND no error
    if (user && !error) {
      redirect(redirectTarget);
    }
  }

  return (
    <div className="w-full">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          <section className="order-2 flex flex-col justify-center gap-6 lg:order-1">
            <div className="flex flex-col gap-4">
              <Badge variant="secondary" className="w-fit gap-2 px-3 py-1.5 text-sm">
                <Shield className="size-4" aria-hidden />
                Trusted by 200+ restaurants
              </Badge>

              <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
                Streamline your restaurant operations
              </h1>

              <p className="text-lg text-muted-foreground">
                Access your operations console to manage bookings, optimize seating, and keep your
                team aligned—all in real-time.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {OPS_SIGNIN_FEATURES.map((feature) => {
                const Icon = feature.icon;

                return (
                  <Card key={feature.title} className="border-border/70 bg-card/95 shadow-sm">
                    <CardContent className="flex items-start gap-3 p-3.5">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-primary">
                        <Icon className="size-5" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-foreground">
                          {feature.title}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {feature.description}
                        </span>
                      </span>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <Alert variant="info">
              <Shield className="size-4" aria-hidden />
              <AlertTitle>Enterprise security</AlertTitle>
              <AlertDescription>
                <span className="flex flex-wrap gap-x-2 gap-y-1 text-xs">
                  <span>SOC 2 Type II</span>
                  <span aria-hidden>•</span>
                  <span>99.9% uptime</span>
                  <span aria-hidden>•</span>
                  <span>End-to-end encryption</span>
                </span>
              </AlertDescription>
            </Alert>
          </section>

          <section className="order-1 flex flex-col justify-center lg:order-2">
            {hasError && errorMessage && (
              <Alert variant="destructive" className="mb-6">
                <AlertCircle className="size-4" aria-hidden />
                <AlertTitle>Unable to sign in</AlertTitle>
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            <Card className="border-border/70 bg-card shadow-lg shadow-primary/5">
              <CardHeader className="p-6 sm:p-8">
                <OpsSignInForm redirectedFrom={redirectTarget} />
              </CardHeader>

              <CardContent className="px-6 py-0">
                <div className="relative flex items-center">
                  <Separator />
                  <span className="absolute left-1/2 -translate-x-1/2 bg-card px-3 text-sm text-muted-foreground">
                    or
                  </span>
                </div>
              </CardContent>

              <CardFooter className="flex flex-col gap-3 bg-muted/35 p-6">
                <p className="text-center text-sm text-muted-foreground">
                  Looking to make a reservation?
                </p>
                <Button asChild variant="outline" className="w-full">
                  <a href={guestSignInUrl}>
                    Sign in as a guest
                    <ArrowRight data-icon="inline-end" aria-hidden />
                  </a>
                </Button>
              </CardFooter>
            </Card>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              Need help?{' '}
              <Button asChild variant="link" className="h-auto p-0 align-baseline">
                <a href="mailto:support@sajiloreserve.com">Contact support</a>
              </Button>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
