import IORedis, { type RedisOptions } from "ioredis";

import { env } from "@/lib/env";

let sharedConnection: IORedis | null = null;

function buildRedisOptions(): RedisOptions {
  const config = env.queue;

  // BullMQ requires maxRetriesPerRequest: null for blocking commands
  const baseOptions: RedisOptions = {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };

  if (config.redisUrl) {
    // Parse URL and merge with base options (URL alone doesn't set maxRetriesPerRequest)
    const url = new URL(config.redisUrl);
    const useTls = url.protocol === "rediss:";
    return {
      ...baseOptions,
      host: url.hostname,
      port: parseInt(url.port, 10) || 6379,
      username: url.username || undefined,
      password: url.password || undefined,
      ...(useTls ? { tls: {} } : {}),
    };
  }

  if (!config.host) {
    throw new Error(
      "Queue Redis configuration missing. Provide QUEUE_REDIS_URL or QUEUE_REDIS_HOST/QUEUE_REDIS_PORT.",
    );
  }

  const options: RedisOptions = {
    ...baseOptions,
    host: config.host,
    port: config.port ?? 6379,
    username: config.username,
    password: config.password,
  };

  if (config.tls) {
    options.tls = {};
  }

  return options;
}

export function getRedisConnection(): IORedis {
  if (sharedConnection) {
    return sharedConnection;
  }

  const options = buildRedisOptions();
  sharedConnection = new IORedis(options);

  sharedConnection.on("error", (error) => {
    console.error("[queue][redis] connection error", {
      message: error instanceof Error ? error.message : String(error),
    });
  });

  return sharedConnection;
}

export async function closeRedisConnection(): Promise<void> {
  if (!sharedConnection) {
    return;
  }
  const connection = sharedConnection;
  sharedConnection = null;
  await connection.quit().catch((error) => {
    console.warn("[queue][redis] failed to close connection", {
      error: error instanceof Error ? error.message : String(error),
    });
  });
}
