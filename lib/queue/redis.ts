import IORedis, { type RedisOptions } from "ioredis";

import { env } from "@/lib/env";

let sharedConnection: IORedis | null = null;

function buildRedisOptions(): RedisOptions | string {
  const config = env.queue;
  if (config.redisUrl) {
    return config.redisUrl;
  }

  if (!config.host) {
    throw new Error(
      "Queue Redis configuration missing. Provide QUEUE_REDIS_URL or QUEUE_REDIS_HOST/QUEUE_REDIS_PORT.",
    );
  }

  const options: RedisOptions = {
    host: config.host,
    port: config.port ?? 6379,
    username: config.username,
    password: config.password,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
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
  sharedConnection = typeof options === "string" ? new IORedis(options) : new IORedis(options);

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
