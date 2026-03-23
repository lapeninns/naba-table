export function getRedisConnection(): never {
  throw new Error(
    'Redis queue connections were removed during the Cloudflare queue migration. Use the email queue gateway instead.',
  );
}

export async function closeRedisConnection(): Promise<void> {
  return Promise.resolve();
}
