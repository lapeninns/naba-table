const DEBUG_ENABLED = process.env.NODE_ENV !== "production";

export type AnalyticsEvent =
  | "restaurant_list_viewed"
  | "restaurant_selected"
  | "restaurants_empty"
  | "restaurants_list_error"
  | "select_date"
  | "select_party"
  | "select_time"
  | "confirm_open"
  | "details_submit"
  | "booking_created"
  | "dashboard_viewed"
  | "booking_cancelled"
  | "booking_cancel_error"
  | "network_offline"
  | "profile_updated"
  | "profile_upload_error";

type AnalyticsProps = Record<string, unknown>;

type PlausibleWindow = Window & {
  // eslint-disable-next-line no-unused-vars
  plausible?: (event: any, options?: any) => void;
};

function sanitizeProps(props?: AnalyticsProps): AnalyticsProps | undefined {
  if (!props) return undefined;
  return Object.fromEntries(
    Object.entries(props).filter(([, value]) => value !== undefined && value !== null),
  );
}

export function track(event: AnalyticsEvent, props?: AnalyticsProps) {
  if (typeof window === "undefined") return;

  const payload = sanitizeProps(props);
  const plausible = (window as PlausibleWindow).plausible;

  try {
    if (typeof plausible === "function") {
      plausible(event, payload ? { props: payload } : undefined);
    }
  } catch (error) {
    if (DEBUG_ENABLED) {
      console.warn("[analytics] failed to send event", event, error);
    }
  }

  if (DEBUG_ENABLED) {
    console.debug(`[analytics] ${event}`, payload ?? {});
  }
}
