// This file configures the initialization of Sentry and PostHog on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';
const isOpsRoute =
  typeof window !== 'undefined' &&
  (window.location.pathname.startsWith('/app') || window.location.hostname.startsWith('app.'));
const enableReplay = !isOpsRoute;

// Initialize Sentry
Sentry.init({
  dsn: 'https://1488f284160e83bd738cf606f0ccf826@o4510764192497664.ingest.de.sentry.io/4510764200034384',

  // Add optional integrations for additional features
  integrations: enableReplay ? [Sentry.replayIntegration()] : [],

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,
  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Define how likely Replay events are sampled.
  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: enableReplay ? 0.1 : 0,

  // Define how likely Replay events are sampled when an error occurs.
  replaysOnErrorSampleRate: enableReplay ? 1.0 : 0,

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,
});

// PostHog is initialized in the client provider to defer work off the critical path.
const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

// Capture pageview on route transition
export const onRouterTransitionStart: typeof Sentry.captureRouterTransitionStart = (...args) => {
  Sentry.captureRouterTransitionStart(...args);

  // Capture pageview in PostHog
  if (posthogKey && posthogHost) {
    const posthogClient = (window as Window & { posthog?: { capture: (event: string, payload: Record<string, unknown>) => void } })
      .posthog;

    if (posthogClient) {
      posthogClient.capture('$pageview', {
        $current_url: window.location.href,
      });
    }
  }
};
