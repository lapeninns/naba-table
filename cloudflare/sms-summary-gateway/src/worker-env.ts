import type { DailySummaryQueueMessage } from './contracts';

export type SmsSummaryWorkerEnv = {
  DAILY_BOOKING_SUMMARY_QUEUE: {
    send: (message: DailySummaryQueueMessage) => Promise<void>;
  };
  DAILY_BOOKING_SUMMARY_STATE: {
    idFromName: (name: string) => unknown;
    get: (id: unknown) => {
      fetch: (request: Request | string, init?: RequestInit) => Promise<Response>;
    };
  };
  TWILIO_ACCOUNT_SID: string;
  TWILIO_API_KEY_SID: string;
  TWILIO_API_KEY_SECRET: string;
  TWILIO_MESSAGING_SERVICE_SID: string;
  TWILIO_WHATSAPP_SENDER: string;
  TWILIO_WHATSAPP_MANAGER_SUMMARY_CONTENT_SID: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  INTERNAL_TRIGGER_TOKEN: string;
  DEPLOY_SHA?: string;
  ERROR_INSIGHT_TOKEN?: string;
  ERROR_INSIGHT_WEBHOOK_URL?: string;
  POSTHOG_PROJECT_API_KEY?: string;
  POSTHOG_HOST?: string;
  CF_VERSION_METADATA?: { id: string; tag: string; timestamp: string };
};
