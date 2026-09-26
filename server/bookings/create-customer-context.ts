import { upsertCustomer } from '@/server/customers';

import { buildDeterministicIdempotencyKey } from './idempotency';

export type BookingCreateCustomerUpserter = typeof upsertCustomer;
export type BookingCreateIdempotencyKeyBuilder = typeof buildDeterministicIdempotencyKey;

type BookingCreateCustomerClient = Parameters<typeof upsertCustomer>[0];
type BookingCreateCustomer = Awaited<ReturnType<typeof upsertCustomer>>;

export type BookingCreateCustomerContext = {
  customer: BookingCreateCustomer;
  deterministicIdempotencyKey: string;
  idempotencyKey: string;
};

export async function resolveBookingCreateCustomerContext(args: {
  client: BookingCreateCustomerClient;
  restaurantId: string;
  email: string;
  phone: string;
  name: string;
  marketingOptIn?: boolean | null;
  bookingDate: string;
  startTime: string;
  endTime: string;
  partySize: number;
  headerIdempotencyKey?: string | null;
  customerUpserter?: BookingCreateCustomerUpserter;
  idempotencyKeyBuilder?: BookingCreateIdempotencyKeyBuilder;
}): Promise<BookingCreateCustomerContext> {
  const customer = await (args.customerUpserter ?? upsertCustomer)(args.client, {
    restaurantId: args.restaurantId,
    email: args.email,
    phone: args.phone,
    name: args.name,
    marketingOptIn: args.marketingOptIn ?? false,
    identityMatchMode: 'strict',
    allowExistingUpdates: false,
  });

  const deterministicIdempotencyKey = (
    args.idempotencyKeyBuilder ?? buildDeterministicIdempotencyKey
  )({
    restaurantId: args.restaurantId,
    customerId: customer.id,
    bookingDate: args.bookingDate,
    startTime: args.startTime,
    endTime: args.endTime,
    partySize: args.partySize,
  });

  return {
    customer,
    deterministicIdempotencyKey,
    idempotencyKey: args.headerIdempotencyKey ?? deterministicIdempotencyKey,
  };
}
