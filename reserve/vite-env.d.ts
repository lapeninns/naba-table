/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RESERVE_API_BASE_URL?: string;
  readonly VITE_RESERVE_API_TIMEOUT_MS?: string;
  readonly VITE_RESERVE_V2_ENABLED?: string;
  readonly VITE_RESERVE_DEFAULT_RESTAURANT_ID?: string;
  readonly VITE_RESERVE_DEFAULT_VENUE_NAME?: string;
  readonly VITE_RESERVE_DEFAULT_VENUE_ADDRESS?: string;
  readonly VITE_RESERVE_DEFAULT_VENUE_TIMEZONE?: string;
  readonly VITE_RESERVE_DEFAULT_VENUE_EMAIL?: string;
  readonly VITE_RESERVE_DEFAULT_VENUE_PHONE?: string;
  readonly VITE_RESERVE_DEFAULT_VENUE_POLICY?: string;
  readonly RESERVE_DEFAULT_RESTAURANT_ID?: string;
  readonly RESERVE_ANALYTICS_DEBUG?: string;
  readonly VITE_RESERVE_ROUTER_BASE_PATH?: string;
  readonly RESERVE_ROUTER_BASE_PATH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
