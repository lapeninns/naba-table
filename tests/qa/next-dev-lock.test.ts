import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { clearNextDevLockIfPortClosed } from '@/scripts/qa/clear-next-dev-lock';

const openServers: net.Server[] = [];

function tempLockPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-next-dev-lock-'));
  fs.mkdirSync(path.join(dir, '.next/dev'), { recursive: true });
  return path.join(dir, '.next/dev/lock');
}

function listenOnEphemeralPort(): Promise<{ port: number; server: net.Server }> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Expected an ephemeral TCP port'));
        return;
      }
      openServers.push(server);
      resolve({ port: address.port, server });
    });
  });
}

function closeServer(server: net.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

afterEach(async () => {
  await Promise.all(
    openServers.splice(0).map((server) => {
      if (!server.listening) {
        return Promise.resolve();
      }
      return closeServer(server);
    }),
  );
});

describe('Next dev lock cleanup', () => {
  it('@p0 @browser @local-only removes stale locks when the app port is closed', async () => {
    const { port, server } = await listenOnEphemeralPort();
    await closeServer(server);
    const lockPath = tempLockPath();
    fs.writeFileSync(lockPath, '');

    const result = await clearNextDevLockIfPortClosed({ lockPath, port });

    expect(result).toBe('removed');
    expect(fs.existsSync(lockPath)).toBe(false);
  });

  it('@p0 @browser @local-only preserves locks when the app port is listening', async () => {
    const { port } = await listenOnEphemeralPort();
    const lockPath = tempLockPath();
    fs.writeFileSync(lockPath, '');

    const result = await clearNextDevLockIfPortClosed({ lockPath, port });

    expect(result).toBe('preserved');
    expect(fs.existsSync(lockPath)).toBe(true);
  });
});
