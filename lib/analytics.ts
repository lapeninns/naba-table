import { sanitizeAnalyticsProps, type AnalyticsProps } from '@/lib/analytics/schema';

const DEBUG_ENABLED = process.env.NODE_ENV !== 'production';
const POSTHOG_ENABLED = Boolean(
  process.env.NEXT_PUBLIC_POSTHOG_KEY && process.env.NEXT_PUBLIC_POSTHOG_HOST,
);

export const ANALYTICS_EVENTS = [
  'restaurant_list_viewed',
  'restaurant_selected',
  'restaurants_empty',
  'restaurants_list_error',
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
  'dashboard_viewed',
  'booking_cancelled',
  'booking_cancel_error',
  'dashboard_cancel_opened',
  'network_offline',
  'wizard_offline_detected',
  'wizard_submit_failed',
  'booking_timeout_unrecovered',
  'client_error_reported',
  'profile_updated',
  'profile_upload_error',
  'profile_update_duplicate',
  'restaurant_profile_editor_viewed',
  'restaurant_profile_edit_started',
  'restaurant_profile_validation_error',
  'restaurant_profile_section_saved',
  'restaurant_profile_section_save_failed',
  'restaurant_profile_dropoff_before_save',
  'restaurant_profile_save_all_clicked',
  'restaurant_profile_logo_validation_error',
  'restaurant_profile_logo_saved',
  'restaurant_profile_logo_save_failed',
  'auth_guest_signin_viewed',
  'auth_guest_signin_attempt',
  'auth_guest_signin_error',
  'auth_ops_signin_viewed',
  'auth_ops_signin_attempt',
  'auth_ops_signin_success',
  'auth_ops_signin_error',
  'auth_signin_viewed',
  'auth_signin_attempt',
  'auth_signin_error',
  'auth_signin_success',
  'auth_magiclink_sent',
  'user_signed_up',
] as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];

type PosthogQueuedEvent = { event: string; payload: AnalyticsProps };

type PlausibleEventOptions = {
  props?: AnalyticsProps;
  url?: string;
  referrer?: string;
  revenue?: number;
  callback?: () => void;
};

type PlausibleWindow = Window & {
  plausible?: (event: AnalyticsEvent, options?: PlausibleEventOptions) => void;
};

type PosthogWindow = Window & {
  posthog?: {
    capture: (event: string, payload?: AnalyticsProps) => void;
  };
  __posthogQueue?: PosthogQueuedEvent[];
};

function capturePosthog(event: AnalyticsEvent, payload: AnalyticsProps): void {
  if (typeof window === 'undefined' || !POSTHOG_ENABLED) return;

  const win = window as PosthogWindow;
  if (win.posthog && typeof win.posthog.capture === 'function') {
    win.posthog.capture(event, payload);
    return;
  }

  if (!win.__posthogQueue) {
    win.__posthogQueue = [];
  }
  win.__posthogQueue.push({ event, payload });
}

export function track(event: AnalyticsEvent, props?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  if (!ANALYTICS_EVENTS.includes(event)) {
    if (DEBUG_ENABLED) {
      console.warn('[analytics] refused to send unknown event', event);
    }
    return;
  }

  const payload = sanitizeAnalyticsProps(props);
  const plausible = (window as PlausibleWindow).plausible;

  try {
    if (typeof plausible === 'function') {
      plausible(event, payload ? { props: payload } : undefined);
    }
  } catch (error) {
    if (DEBUG_ENABLED) {
      console.warn('[analytics] failed to send event', event, error);
    }
  }

  try {
    capturePosthog(event, payload ?? {});
  } catch (error) {
    if (DEBUG_ENABLED) {
      console.warn('[analytics] failed to send event to PostHog', event, error);
    }
  }

  if (DEBUG_ENABLED) {
    console.debug(`[analytics] ${event}`, payload ?? {});
  }
}
