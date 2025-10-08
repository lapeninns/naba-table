import { runtime } from '@shared/config/runtime';

type AnalyticsProps = Record<string, unknown>;

type PlausibleWindow = Window & {
  plausible?: (event: string, options?: { props?: AnalyticsProps }) => void;
};

export const ANALYTICS_EVENTS = [
  'select_date',
  'select_party',
  'select_time',
  'confirm_open',
  'details_submit',
  'booking_created',
  'wizard_offline_detected',
  'wizard_submit_failed',
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

  if (debugEnabled) {
    console.debug('[analytics]', event, payload ?? {});
  }
};
