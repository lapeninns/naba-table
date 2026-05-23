import { describe, expect, it } from 'vitest';

import {
  hashJson,
  isEqualValue,
  stableStringify,
  toObjectRecord,
  toStringRecord,
} from '@/server/google-business-profile/workflowSerialization';

describe('google business profile workflow serialization helpers', () => {
  it('stringifies object keys in stable sorted order', () => {
    expect(stableStringify({ b: 2, a: 1, nested: { z: true, c: null } })).toBe(
      '{"a":1,"b":2,"nested":{"c":null,"z":true}}',
    );
  });

  it('keeps hashes stable across equivalent object key orderings', () => {
    expect(hashJson({ b: 2, a: 1 })).toBe(hashJson({ a: 1, b: 2 }));
  });

  it('compares nullish values through the workflow null-normalization rule', () => {
    expect(isEqualValue(undefined, null)).toBe(true);
    expect(isEqualValue({ b: 2, a: 1 }, { a: 1, b: 2 })).toBe(true);
    expect(isEqualValue({ a: 1 }, { a: 2 })).toBe(false);
  });

  it('coerces JSON objects to boolean and string records', () => {
    expect(toObjectRecord({ profile: true, phone: false, count: 1, label: 'yes' })).toEqual({
      phone: false,
      profile: true,
    });
    expect(toStringRecord({ profile: 'hash-1', phone: false, count: 1 })).toEqual({
      profile: 'hash-1',
    });
  });
});
