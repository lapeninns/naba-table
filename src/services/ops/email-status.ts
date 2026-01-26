import { fetchJson } from '@/lib/http/fetchJson';

import type { HttpError } from '@/lib/http/errors';
import type { OpsEmailJobType, OpsEmailStatusPage, OpsServiceError } from '@/types/ops';

const OPS_EMAIL_STATUS_BASE = '/api/ops/email-status';

export type EmailStatusParams = {
  restaurantId: string;
  page?: number;
  pageSize?: number;
  windowMinutes?: number;
  type?: OpsEmailJobType;
};

export interface EmailStatusService {
  list(params: EmailStatusParams): Promise<OpsEmailStatusPage>;
}

export class NotImplementedEmailStatusService implements EmailStatusService {
  private error(message: string): never {
    throw new Error(`[ops][emailStatusService] ${message}`);
  }

  list(): Promise<OpsEmailStatusPage> {
    this.error('list not implemented');
  }
}

export type EmailStatusServiceFactory = () => EmailStatusService;

function buildSearch(params: EmailStatusParams): string {
  const searchParams = new URLSearchParams();
  searchParams.set('restaurantId', params.restaurantId);
  if (params.page) searchParams.set('page', String(params.page));
  if (params.pageSize) searchParams.set('pageSize', String(params.pageSize));
  if (params.windowMinutes) searchParams.set('windowMinutes', String(params.windowMinutes));
  if (params.type) searchParams.set('type', params.type);
  return searchParams.toString();
}

export function createBrowserEmailStatusService(): EmailStatusService {
  return {
    async list(params) {
      if (!params.restaurantId) {
        throw new Error('[ops][emailStatusService] restaurantId is required');
      }
      const search = buildSearch(params);
      const url = search ? `${OPS_EMAIL_STATUS_BASE}?${search}` : OPS_EMAIL_STATUS_BASE;
      return fetchJson<OpsEmailStatusPage>(url);
    },
  };
}

export function createEmailStatusService(factory?: EmailStatusServiceFactory): EmailStatusService {
  try {
    return factory ? factory() : createBrowserEmailStatusService();
  } catch (error) {
    if (error instanceof Error) {
      console.error('[ops][emailStatusService] failed to instantiate', error.message);
    }
    return new NotImplementedEmailStatusService();
  }
}

export type EmailStatusServiceError = OpsServiceError | HttpError;
