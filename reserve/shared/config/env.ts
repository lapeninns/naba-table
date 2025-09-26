import { z } from 'zod';

const envSchema = z.object({
  API_BASE_URL: z.string().default('/api'),
  API_TIMEOUT_MS: z.number().int().positive().default(15000),
  RESERVE_V2_ENABLED: z.boolean().default(false),
});

const raw = {
  API_BASE_URL: process.env.NEXT_PUBLIC_RESERVE_API_BASE_URL ?? '/api',
  API_TIMEOUT_MS: Number(process.env.NEXT_PUBLIC_RESERVE_API_TIMEOUT_MS ?? 15000),
  RESERVE_V2_ENABLED: process.env.NEXT_PUBLIC_RESERVE_V2 === 'true',
};

export const env = envSchema.parse(raw);
