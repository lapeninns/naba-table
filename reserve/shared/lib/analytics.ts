import { runtime } from '@shared/config/runtime';

type AnalyticsProps = Record<string, unknown>;

type PlausibleWindow = Window & {
  plausible?: (event: string, options?: { props?: AnalyticsProps }) => void;
};

type PosthogQueuedEvent = { event: string; payload: AnalyticsProps };

type PosthogWindow = Window & {
  posthog?: { capture: (event: string, payload?: AnalyticsProps) => void };
  __posthogQueue?: PosthogQueuedEvent[];
};

// Mirrors lib/analytics.ts capturePosthog: when the wizard renders inside the main
// Next.js app (the /restaurants/[slug]/book page), the PostHogProvider has set
// window.posthog and drains window.__posthogQueue, so reserve events reach PostHog.
// In the standalone Vite build (no provider) this is a silent no-op.
const capturePosthog = (event: string, payload: AnalyticsProps | undefined): void => {
  const win = window as PosthogWindow;
  if (win.posthog && typeof win.posthog.capture === 'function') {
    win.posthog.capture(event, payload);
    return;
  }
  if (!win.__posthogQueue) {
    win.__posthogQueue = [];
  }
  win.__posthogQueue.push({ event, payload: payload ?? {} });
};

export const ANALYTICS_EVENTS = [
  'select_date',
  'select_party',
  'select_time',
  'confirm_open',
  'details_submit',
  'booking_created',
  'booking_check_in',
  'booking_check_out',
  'booking_no_show',
  'booking_completed',
  'booking_error_boundary_triggered',
  'wizard_offline_detected',
  'wizard_submit_failed',
  'booking_timeout_unrecovered',
  'client_error_reported',
  'user_signed_up',
  'reserve_step_viewed',
] as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];

const debugOverride = runtime.readBoolean('RESERVE_ANALYTICS_DEBUG');
const debugEnabled =
  typeof debugOverride === 'boolean' ? debugOverride : runtime.isDev || runtime.isTest;

const sanitizeProps = (props?: AnalyticsProps): AnalyticsProps | undefined => {
  if (!props) return undefined;
  return Object.fromEntries(
    Object.entries(props).filter(([, value]) => value !== undefined && value !== null),
  );
};

export const track = (event: AnalyticsEvent, props?: AnalyticsProps) => {
  if (typeof window === 'undefined') return;

  if (!ANALYTICS_EVENTS.includes(event)) {
    if (debugEnabled) {
      console.warn('[analytics] refused to send unknown event', event);
    }
    return;
  }

  const payload = sanitizeProps(props);
  const plausible = (window as PlausibleWindow).plausible;

  try {
    if (typeof plausible === 'function') {
      plausible(event, payload ? { props: payload } : undefined);
    }
  } catch (error) {
    if (debugEnabled) {
      console.warn('[analytics] failed to send event', event, error);
    }
  }

  try {
    capturePosthog(event, payload);
  } catch (error) {
    if (debugEnabled) {
      console.warn('[analytics] failed to send event to PostHog', event, error);
    }
  }

  if (debugEnabled) {
    console.debug('[analytics]', event, payload ?? {});
  }
};
