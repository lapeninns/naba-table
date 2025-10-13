import type { OpsServiceError } from '@/types/ops';

export type CustomerProfile = {
  id: string;
  restaurantId: string;
  name: string;
  email: string;
  phone: string;
  marketingOptIn: boolean;
  createdAt: string;
  updatedAt: string;
  firstBookingAt: string | null;
  lastBookingAt: string | null;
  totalBookings: number;
  totalCovers: number;
  totalCancellations: number;
};

export interface CustomerService {
  list(restaurantId: string, params?: Record<string, unknown>): Promise<CustomerProfile[]>;
}

export class NotImplementedCustomerService implements CustomerService {
  private error(message: string): never {
    throw new Error(`[ops][customerService] ${message}`);
  }

  list(): Promise<CustomerProfile[]> {
    this.error('list not implemented');
  }
}

export type CustomerServiceFactory = () => CustomerService;

export function createCustomerService(factory?: CustomerServiceFactory): CustomerService {
  try {
    return factory ? factory() : new NotImplementedCustomerService();
  } catch (error) {
    if (error instanceof Error) {
      console.error('[ops][customerService] failed to instantiate', error.message);
    }
    return new NotImplementedCustomerService();
  }
}

export type CustomerServiceError = OpsServiceError | Error;
