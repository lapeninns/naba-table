import { fetchJson } from '@/lib/http/fetchJson';

import type { HttpError } from '@/lib/http/errors';
import type { OpsCustomersPage, OpsServiceError } from '@/types/ops';

const OPS_CUSTOMERS_BASE = '/api/customers';

export type CustomerListParams = {
  restaurantId: string;
  page?: number;
  pageSize?: number;
  sort?: 'asc' | 'desc';
};

export interface CustomerService {
  list(params: CustomerListParams): Promise<OpsCustomersPage>;
}

export class NotImplementedCustomerService implements CustomerService {
  private error(message: string): never {
    throw new Error(`[ops][customerService] ${message}`);
  }

  list(): Promise<OpsCustomersPage> {
    this.error('list not implemented');
  }
}

export type CustomerServiceFactory = () => CustomerService;

function buildSearch(params: CustomerListParams): string {
  const searchParams = new URLSearchParams();
  searchParams.set('restaurantId', params.restaurantId);
  if (params.page) searchParams.set('page', String(params.page));
  if (params.pageSize) searchParams.set('pageSize', String(params.pageSize));
  if (params.sort) searchParams.set('sort', params.sort);
  return searchParams.toString();
}

export function createBrowserCustomerService(): CustomerService {
  return {
    async list(params) {
      if (!params.restaurantId) {
        throw new Error('[ops][customerService] restaurantId is required');
      }
      const search = buildSearch(params);
      const url = search ? `${OPS_CUSTOMERS_BASE}?${search}` : OPS_CUSTOMERS_BASE;
      return fetchJson<OpsCustomersPage>(url);
    },
  };
}

export function createCustomerService(factory?: CustomerServiceFactory): CustomerService {
  try {
    return factory ? factory() : createBrowserCustomerService();
  } catch (error) {
    if (error instanceof Error) {
      console.error('[ops][customerService] failed to instantiate', error.message);
    }
    return new NotImplementedCustomerService();
  }
}

export type CustomerServiceError = OpsServiceError | HttpError;
