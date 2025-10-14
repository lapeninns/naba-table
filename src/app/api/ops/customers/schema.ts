import { z } from "zod";

export const opsCustomersQuerySchema = z.object({
  restaurantId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  sort: z.enum(["asc", "desc"]).default("desc"),
});

export type OpsCustomersQuery = z.infer<typeof opsCustomersQuerySchema>;

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
