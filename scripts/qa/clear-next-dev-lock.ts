import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type ClearNextDevLockResult = 'missing' | 'preserved' | 'removed';

export type ClearNextDevLockOptions = {
  host?: string;
  lockPath?: string;
  port?: number;
  timeoutMs?: number;
};

function readPort(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function canConnectToPort({
  host,
  port,
  timeoutMs,
}: {
  host: string;
  port: number;
  timeoutMs: number;
}): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    let settled = false;

    const finish = (result: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.once('timeout', () => finish(false));
  });
}

export async function clearNextDevLockIfPortClosed({
  host = '127.0.0.1',
  lockPath = path.resolve(process.cwd(), '.next/dev/lock'),
  port = readPort(process.env.QA_APP_PORT ?? process.env.NEXT_DEV_PORT, 5180),
  timeoutMs = 500,
}: ClearNextDevLockOptions = {}): Promise<ClearNextDevLockResult> {
  if (!fs.existsSync(lockPath)) {
    return 'missing';
  }

  const portIsListening = await canConnectToPort({ host, port, timeoutMs });
  if (portIsListening) {
    return 'preserved';
  }

  fs.rmSync(lockPath, { force: true });
  return 'removed';
}

function isCliEntry(): boolean {
  return process.argv[1] ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url) : false;
}

async function main(): Promise<void> {
  const result = await clearNextDevLockIfPortClosed();
  if (result === 'removed') {
    console.log('[qa:next-lock] removed stale .next/dev/lock before starting Next dev.');
  }
}

if (isCliEntry()) {
  void main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
