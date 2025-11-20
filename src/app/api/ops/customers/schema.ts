import { z } from "zod";

export const opsCustomersQuerySchema = z.object({
  restaurantId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  sort: z.enum(["asc", "desc"]).default("desc"),
  sortBy: z.enum(["last_visit", "bookings"]).default("last_visit"),
  search: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  marketingOptIn: z.enum(["all", "opted_in", "opted_out"]).default("all"),
  lastVisit: z.enum(["any", "30d", "90d", "365d", "never"]).default("any"),
  minBookings: z.coerce.number().int().min(0).max(10000).default(0),
});

export type OpsCustomersQuery = z.infer<typeof opsCustomersQuerySchema>;

export function parseOpsCustomersQuery(rawParams: Record<string, string | undefined>) {
  return opsCustomersQuerySchema.safeParse(rawParams);
}

export type CustomerDTO = {
  id: string;
  name: string;
  email: string;
  phone: string;
  marketingOptIn: boolean;
  createdAt: string;
  firstBookingAt: string | null;
  lastBookingAt: string | null;
  totalBookings: number;
  totalCovers: number;
  totalCancellations: number;
};

export type PageInfo = {
  page: number;
  pageSize: number;
  total: number;
  hasNext: boolean;
};

export type OpsCustomersResponse = {
  items: CustomerDTO[];
  pageInfo: PageInfo;
};
