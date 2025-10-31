import { describe, expect, it, vi } from "vitest";

import { upsertCustomer } from "../customers";

import type { CustomerRow } from "../customers";

const createMockClient = (existingRow: CustomerRow) => {
  const upsertError = {
    code: "23505",
    message:
      'duplicate key value violates unique constraint "customers_restaurant_id_email_normalized_key"',
  };

  const upsertChain = {
    select: vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: upsertError }),
    }),
  };

  const selectChain = {
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: existingRow, error: null }),
  };

  const updateChain = {
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: existingRow, error: null }),
    }),
  };

  const customersRepo = {
    upsert: vi.fn().mockReturnValue(upsertChain),
    select: vi.fn().mockReturnValue(selectChain),
    update: vi.fn().mockReturnValue(updateChain),
  };

  const client = {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "customers") {
        return customersRepo;
      }
      throw new Error(`Unexpected table ${table}`);
    }),
  };

  return { client, customersRepo };
};

describe("upsertCustomer", () => {
  it("returns an existing customer when a unique email conflict occurs", async () => {
    const existingRow = {
      id: "cust-123",
      restaurant_id: "rest-123",
      email: "guest@example.com",
      phone: "07123456789",
      full_name: "Guest",
      marketing_opt_in: false,
      created_at: "2025-01-18T00:00:00.000Z",
      updated_at: "2025-01-18T00:00:00.000Z",
      email_normalized: "guest@example.com",
      phone_normalized: "07123456789",
      auth_user_id: null,
      user_profile_id: null,
      notes: null,
    } satisfies CustomerRow;

    const { client } = createMockClient(existingRow);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await upsertCustomer(client as any, {
      restaurantId: existingRow.restaurant_id,
      email: existingRow.email,
      phone: existingRow.phone,
      name: existingRow.full_name,
      marketingOptIn: existingRow.marketing_opt_in,
    });

    expect(result).toEqual(existingRow);
  });
});
