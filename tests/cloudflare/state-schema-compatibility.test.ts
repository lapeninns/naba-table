import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

type StateSchema = {
  service: string;
  version: number;
  migrationTags?: string[];
  durableObjects: Array<{
    className: string;
    migrationTag: string;
    storage: string;
    keyspaces: Record<string, string>;
  }>;
};

const CASES = [
  {
    directory: 'cloudflare/email-queue-gateway',
    classes: ['EmailQueueState', 'RateLimitState', 'CapacityVersionState'],
    tags: ['v1', 'v2'],
  },
  {
    directory: 'cloudflare/sms-summary-gateway',
    classes: ['DailyBookingSummaryState'],
    tags: ['v1', 'v2'],
  },
] as const;

describe.each(CASES)('$directory Durable Object state schema', ({ directory, classes, tags }) => {
  const schema = JSON.parse(
    readFileSync(path.join(process.cwd(), directory, 'state-schema.json'), 'utf8'),
  ) as StateSchema;
  const wrangler = readFileSync(path.join(process.cwd(), directory, 'wrangler.jsonc'), 'utf8');

  it('documents every bound class and persisted keyspace', () => {
    expect(schema.version).toBeGreaterThan(0);
    expect(schema.durableObjects.map((object) => object.className).sort()).toEqual(
      [...classes].sort(),
    );
    for (const object of schema.durableObjects) {
      expect(object.storage).toBe('sqlite');
      expect(Object.keys(object.keyspaces).length).toBeGreaterThan(0);
      expect(wrangler).toContain(`"${object.className}"`);
    }
  });

  it('keeps migration tags append-only and represented in Wrangler', () => {
    const documentedTags =
      schema.migrationTags ??
      [...new Set(schema.durableObjects.map((object) => object.migrationTag))].sort();
    expect(documentedTags).toEqual([...tags]);
    for (const tag of tags) expect(wrangler).toContain(`"tag": "${tag}"`);
  });
});
