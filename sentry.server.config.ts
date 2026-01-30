// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: 'https://1488f284160e83bd738cf606f0ccf826@o4510764192497664.ingest.de.sentry.io/4510764200034384',

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,

  // Release tracking for error-to-commit correlation
  release: process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_APP_VERSION,

  // Environment tagging
  environment: process.env.APP_ENV || process.env.NODE_ENV || 'development',

  // Enable GitHub integration features
  integrations: [
    Sentry.extraErrorDataIntegration({ depth: 5 }),
  ],

  // Attach stack traces to messages
  attachStacktrace: true,
});
