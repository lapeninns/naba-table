'use client';

import { MailCheck } from 'lucide-react';
import Script from 'next/script';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormRoot } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { fetchJson } from '@/lib/http/fetchJson';
import { getFieldErrors, toUserMessage } from '@/lib/http/userMessage';

const ENDPOINT = '/api/bookings/lookup-email';
const TURNSTILE_ACTION = 'booking_lookup_email';
const TURNSTILE_SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ?? '';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** How long to wait for the Turnstile script before calling the check failed. */
const CAPTCHA_LOAD_TIMEOUT_MS = 15_000;
const CAPTCHA_FAILED_MESSAGE =
  'The security check didn’t load. Turn off content blockers for this page or check your connection, then try the check again.';

export type FindBookingVenue = { slug: string; name: string };

export type FindBookingFormProps = {
  venues: FindBookingVenue[];
  initialVenueSlug?: string | null;
};

type LookupEmailAccepted = { status: 'accepted'; message: string };

const ERROR_COPY: Partial<Record<string, string>> = {
  CHALLENGE_FAILED: 'Please complete the check and try again.',
  RESTAURANT_NOT_FOUND: 'We couldn’t find that venue. Choose it from the list.',
  RATE_LIMITED: 'Too many requests from this device. Wait a few minutes and try again.',
  CSRF_INVALID: 'Your session expired. Refresh the page and try again.',
  BOOKING_LINKS_UNAVAILABLE:
    'Booking links are temporarily unavailable. Contact the venue to manage your booking.',
};

/**
 * "Email me a link" form for guests who lost their booking link. It always
 * shows the same confirmation, whether or not the email has bookings.
 */
export function FindBookingForm({ venues, initialVenueSlug }: FindBookingFormProps) {
  const formId = useId();
  const presetVenue = venues.find((venue) => venue.slug === initialVenueSlug) ?? null;
  const [venueSlug, setVenueSlug] = useState<string>(presetVenue?.slug ?? '');
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<{ venue?: string; email?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [acceptedMessage, setAcceptedMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isCaptchaEnabled = TURNSTILE_SITE_KEY.length > 0;
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaScriptReady, setCaptchaScriptReady] = useState(
    () => typeof window !== 'undefined' && Boolean(window.turnstile),
  );
  const [captchaFailed, setCaptchaFailed] = useState(false);
  const captchaContainerRef = useRef<HTMLDivElement | null>(null);
  const captchaWidgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isCaptchaEnabled || !captchaScriptReady || !window.turnstile) return;
    if (!captchaContainerRef.current || captchaWidgetIdRef.current) return;
    captchaWidgetIdRef.current = window.turnstile.render(captchaContainerRef.current, {
      sitekey: TURNSTILE_SITE_KEY,
      action: TURNSTILE_ACTION,
      callback: (token) => {
        // A slow script can load after the timeout alert; a passed check clears it.
        setCaptchaFailed(false);
        setCaptchaToken(token);
      },
      'expired-callback': () => setCaptchaToken(null),
      'error-callback': () => {
        setCaptchaToken(null);
        setCaptchaFailed(true);
      },
    });
  }, [isCaptchaEnabled, captchaScriptReady]);

  // A blocked script fires neither onLoad nor (always) onError; give up after a while.
  useEffect(() => {
    if (!isCaptchaEnabled || captchaScriptReady || captchaFailed) return;
    const timer = window.setTimeout(() => setCaptchaFailed(true), CAPTCHA_LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [isCaptchaEnabled, captchaScriptReady, captchaFailed]);

  const retryCaptcha = () => {
    setCaptchaFailed(false);
    setCaptchaToken(null);
    setFormError(null);
    if (window.turnstile && captchaWidgetIdRef.current) {
      window.turnstile.reset(captchaWidgetIdRef.current);
      return;
    }
    if (window.turnstile) {
      setCaptchaScriptReady(true);
      return;
    }
    // The script never arrived: reloading the page is the only way to fetch it again.
    window.location.reload();
  };

  const resetCaptcha = () => {
    if (!isCaptchaEnabled) return;
    setCaptchaToken(null);
    if (captchaWidgetIdRef.current && window.turnstile) {
      window.turnstile.reset(captchaWidgetIdRef.current);
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const nextFieldError: { venue?: string; email?: string } = {};
    if (!venueSlug) nextFieldError.venue = 'Choose the venue you booked with.';
    if (!EMAIL_PATTERN.test(email.trim())) nextFieldError.email = 'Enter a valid email address.';
    setFieldError(nextFieldError);
    if (nextFieldError.venue || nextFieldError.email) return;

    if (isCaptchaEnabled && !captchaToken) {
      setFormError(captchaFailed ? null : 'Complete the check to continue.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetchJson<LookupEmailAccepted>(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantSlug: venueSlug,
          email: email.trim(),
          ...(captchaToken ? { turnstileToken: captchaToken } : {}),
        }),
      });
      setAcceptedMessage(response.message);
    } catch (error) {
      const fields = getFieldErrors(error);
      if (fields?.email?.[0]) {
        setFieldError({ email: 'Enter a valid email address.' });
      }
      setFormError(toUserMessage(error, { copy: ERROR_COPY }));
      resetCaptcha();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (acceptedMessage) {
    return (
      <Alert variant="success" aria-live="polite" data-testid="find-booking-accepted">
        <MailCheck className="size-4" aria-hidden />
        <AlertTitle>Check your email</AlertTitle>
        <AlertDescription>
          <p>{acceptedMessage}</p>
          <p className="mt-2">The link opens your booking directly, no password needed.</p>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <FormRoot
      className="space-y-5"
      onSubmit={onSubmit}
      noValidate
      aria-describedby={`${formId}-note`}
    >
      {isCaptchaEnabled ? (
        <Script
          src={TURNSTILE_SCRIPT_SRC}
          strategy="afterInteractive"
          onLoad={() => setCaptchaScriptReady(true)}
          onError={() => setCaptchaFailed(true)}
        />
      ) : null}

      <div className="space-y-2">
        <Label htmlFor={`${formId}-venue`}>Venue</Label>
        {presetVenue ? (
          <p id={`${formId}-venue`} className="pg-body text-sm font-medium">
            {presetVenue.name}
          </p>
        ) : (
          <Select value={venueSlug} onValueChange={setVenueSlug}>
            <SelectTrigger
              id={`${formId}-venue`}
              aria-invalid={Boolean(fieldError.venue)}
              aria-describedby={fieldError.venue ? `${formId}-venue-error` : undefined}
            >
              <SelectValue placeholder="Choose a venue" />
            </SelectTrigger>
            <SelectContent>
              {venues.map((venue) => (
                <SelectItem key={venue.slug} value={venue.slug}>
                  {venue.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {fieldError.venue ? (
          <p id={`${formId}-venue-error`} className="text-sm text-destructive">
            {fieldError.venue}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${formId}-email`}>Email used for the booking</Label>
        <Input
          id={`${formId}-email`}
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={Boolean(fieldError.email)}
          aria-describedby={fieldError.email ? `${formId}-email-error` : undefined}
          placeholder="you@example.com"
        />
        {fieldError.email ? (
          <p id={`${formId}-email-error`} className="text-sm text-destructive">
            {fieldError.email}
          </p>
        ) : null}
      </div>

      {isCaptchaEnabled ? (
        <div
          ref={captchaContainerRef}
          className="min-h-[70px] rounded-[var(--pg-radius-md)] border border-border/80 bg-muted/35 p-2"
          data-testid="find-booking-turnstile"
        />
      ) : null}

      {isCaptchaEnabled && captchaFailed ? (
        <Alert
          variant="destructive"
          aria-live="assertive"
          data-testid="find-booking-captcha-failed"
        >
          <AlertDescription>
            <p>{CAPTCHA_FAILED_MESSAGE}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={retryCaptcha}
            >
              Try the check again
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {formError ? (
        <Alert variant="destructive" aria-live="assertive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <Button
        type="submit"
        size="guest-lg"
        variant="guest-primary"
        className="pg-action pg-focus-ring pg-touch w-full font-semibold sm:w-auto"
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Sending…' : 'Email me a link'}
      </Button>

      <p id={`${formId}-note`} className="pg-caption">
        Booked by phone without an email address, or entered the wrong email? Contact the venue and
        they can update it and resend your confirmation.
      </p>
    </FormRoot>
  );
}
