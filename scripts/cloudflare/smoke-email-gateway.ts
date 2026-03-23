import { randomUUID } from 'node:crypto';

process.env.ENABLE_RATE_LIMIT_IN_DEV ??= 'true';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const { consumeRateLimit } = await import('@/server/security/rate-limit');
  const { requestCloudflareGateway } = await import('@/server/cloudflare/gateway');
  const { enqueueEmailJob, getEmailQueueStatus, removeEmailJob } = await import('@/server/queue/email');
  const { invalidateInventoryCache, isDistributedCacheEnabled } = await import('@/server/capacity/cache');

  const suffix = randomUUID();
  const rateKey = `smoke-rate:${suffix}`;
  const restaurantId = randomUUID();
  const bookingId = randomUUID();
  const jobId = `review_request:${bookingId}`;

  const rateFirst = await consumeRateLimit({ identifier: rateKey, limit: 1, windowMs: 60_000 });
  const rateSecond = await consumeRateLimit({ identifier: rateKey, limit: 1, windowMs: 60_000 });

  const beforeVersions = await requestCloudflareGateway('/capacity/versions/read', {
    method: 'POST',
    body: JSON.stringify({ restaurantIds: [restaurantId] }),
  });

  invalidateInventoryCache(restaurantId);
  await sleep(600);

  const afterVersions = await requestCloudflareGateway('/capacity/versions/read', {
    method: 'POST',
    body: JSON.stringify({ restaurantIds: [restaurantId] }),
  });

  const queueBefore = await getEmailQueueStatus(false);

  await enqueueEmailJob(
    {
      bookingId,
      restaurantId: null,
      type: 'review_request',
      scheduledFor: new Date().toISOString(),
    },
    { jobId, delayMs: 0 },
  );

  const removed = await removeEmailJob(jobId);
  const queueAfter = await getEmailQueueStatus(false);

  const payload = {
    rateLimit: {
      first: { ok: rateFirst.ok, source: rateFirst.source, remaining: rateFirst.remaining },
      second: { ok: rateSecond.ok, source: rateSecond.source, remaining: rateSecond.remaining },
    },
    capacity: {
      distributed: isDistributedCacheEnabled(),
      before: beforeVersions.body,
      after: afterVersions.body,
    },
    queue: {
      beforeWaiting: queueBefore.queue.counts.waiting,
      removed,
      afterWaiting: queueAfter.queue.counts.waiting,
    },
  };

  if (
    payload.rateLimit.first.source !== 'cloudflare' ||
    payload.rateLimit.second.ok !== false ||
    payload.capacity.distributed !== true ||
    payload.queue.removed !== true
  ) {
    throw new Error(`Cloudflare smoke test failed: ${JSON.stringify(payload)}`);
  }

  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
