import { DEV_RESTAURANT_ID } from '../devIds';


import type { CustomerListParams, CustomerService } from '@/services/ops/customers';
import type { OpsCustomer, OpsCustomersPage } from '@/types/ops';


function buildCustomers(): OpsCustomer[] {
  const now = Date.now();
  const isoDaysAgo = (days: number) => new Date(now - days * 24 * 60 * 60 * 1000).toISOString();

  const base: OpsCustomer[] = [
    {
      id: 'cust-1',
      restaurantId: DEV_RESTAURANT_ID,
      name: 'Alexandra Johnson-Smythe The Third',
      email: 'alexandra.johnson-smythe.the.third+very.long.alias@example-very-long-domain.test',
      phone: '+44 7700 900123',
      marketingOptIn: true,
      createdAt: isoDaysAgo(300),
      firstBookingAt: isoDaysAgo(280),
      lastBookingAt: isoDaysAgo(7),
      totalBookings: 12,
      totalCovers: 44,
      totalCancellations: 1,
    },
    {
      id: 'cust-2',
      restaurantId: DEV_RESTAURANT_ID,
      name: 'Sam Patel',
      email: 'sam.patel@example.com',
      phone: '+44 7700 900999',
      marketingOptIn: false,
      createdAt: isoDaysAgo(120),
      firstBookingAt: isoDaysAgo(120),
      lastBookingAt: isoDaysAgo(2),
      totalBookings: 4,
      totalCovers: 10,
      totalCancellations: 0,
    },
    {
      id: 'cust-3',
      restaurantId: DEV_RESTAURANT_ID,
      name: 'Taylor',
      email: 'taylor@example.com',
      phone: '',
      marketingOptIn: true,
      createdAt: isoDaysAgo(40),
      firstBookingAt: null,
      lastBookingAt: null,
      totalBookings: 0,
      totalCovers: 0,
      totalCancellations: 0,
    },
  ];

  const generated = Array.from({ length: 85 }, (_, i) => {
    const n = i + 4;
    return {
      id: `cust-${n}`,
      restaurantId: DEV_RESTAURANT_ID,
      name: `Guest ${n}`,
      email: `guest.${n}@example.com`,
      phone: '',
      marketingOptIn: n % 3 === 0,
      createdAt: isoDaysAgo(10 + (n % 200)),
      firstBookingAt: n % 5 === 0 ? null : isoDaysAgo(9 + (n % 50)),
      lastBookingAt: n % 7 === 0 ? null : isoDaysAgo(n % 90),
      totalBookings: n % 17,
      totalCovers: (n % 17) * ((n % 4) + 1),
      totalCancellations: n % 4 === 0 ? 1 : 0,
    } satisfies OpsCustomer;
  });

  return [...base, ...generated];
}

function matchFilters(customer: OpsCustomer, params: CustomerListParams): boolean {
  if (params.restaurantId !== customer.restaurantId) return false;

  if (params.marketingOptIn && params.marketingOptIn !== 'all') {
    if (params.marketingOptIn === 'opted_in' && !customer.marketingOptIn) return false;
    if (params.marketingOptIn === 'opted_out' && customer.marketingOptIn) return false;
  }

  if (params.minBookings && customer.totalBookings < params.minBookings) return false;

  const q = params.search?.trim().toLowerCase();
  if (q) {
    const hay = `${customer.name} ${customer.email} ${customer.phone}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }

  if (params.lastVisit && params.lastVisit !== 'any') {
    const last = customer.lastBookingAt ? new Date(customer.lastBookingAt).getTime() : null;
    if (params.lastVisit === 'never') return last === null;
    if (last === null) return false;
    const days = Math.floor((Date.now() - last) / (24 * 60 * 60 * 1000));
    const limit = params.lastVisit === '30d' ? 30 : params.lastVisit === '90d' ? 90 : 365;
    if (days > limit) return false;
  }

  return true;
}

export class DevCustomerService implements CustomerService {
  private all: OpsCustomer[];

  constructor() {
    this.all = buildCustomers();
  }

  async list(params: CustomerListParams): Promise<OpsCustomersPage> {
    const page = Math.max(1, Math.floor(params.page ?? 1));
    const pageSize = Math.max(1, Math.min(200, Math.floor(params.pageSize ?? 50)));

    const filtered = this.all.filter((c) => matchFilters(c, params));
    const sorted = filtered.slice().sort((a, b) => {
      const dir = params.sort ?? 'desc';
      const mult = dir === 'asc' ? 1 : -1;
      const sortBy = params.sortBy ?? 'last_visit';
      if (sortBy === 'bookings') {
        return mult * (a.totalBookings - b.totalBookings);
      }
      const at = a.lastBookingAt ? new Date(a.lastBookingAt).getTime() : 0;
      const bt = b.lastBookingAt ? new Date(b.lastBookingAt).getTime() : 0;
      return mult * (at - bt);
    });

    const total = sorted.length;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const items = sorted.slice(start, end);

    return {
      items,
      pageInfo: { page, pageSize, total, hasNext: end < total },
    };
  }
}

export function createDevCustomerService(): CustomerService {
  return new DevCustomerService();
}

