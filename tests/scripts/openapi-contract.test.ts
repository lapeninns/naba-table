import { describe, expect, it } from 'vitest';

import { validateOpenApiDocument } from '@/scripts/governance/openapi-contract';

describe('OpenAPI governance contract', () => {
  it('accepts a documented operation with responses', () => {
    expect(
      validateOpenApiDocument({
        openapi: '3.1.0',
        info: { title: 'Example', version: '1.0.0' },
        paths: { '/health': { get: { responses: { '200': { description: 'Healthy' } } } } },
      }),
    ).toEqual([]);
  });

  it('rejects missing metadata and undocumented operations', () => {
    expect(validateOpenApiDocument({ paths: { '/jobs': { post: {} } } })).toEqual(
      expect.arrayContaining([
        expect.stringContaining('openapi'),
        expect.stringContaining('info.title'),
        expect.stringContaining('POST /jobs'),
      ]),
    );
  });
});
