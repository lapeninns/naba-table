import { describe, expect, it } from 'vitest';

import {
  buildPayloadHash,
  normalizeJsonArray,
  normalizeRecord,
  normalizeStringArray,
  normalizeText,
  pickNestedText,
  toJson,
  uniqueStrings,
} from '@/server/google-business-profile/businessInfoNormalizationCore';

describe('google business profile business info normalization core', () => {
  it('normalizes text and string arrays', () => {
    expect(normalizeText('  Hello  ')).toBe('Hello');
    expect(normalizeText('   ')).toBeNull();
    expect(normalizeText(undefined)).toBeNull();

    expect(normalizeStringArray([' Alpha ', '', null, undefined, 'Beta'])).toEqual([
      'Alpha',
      'Beta',
    ]);
  });

  it('normalizes object records and nested text reads', () => {
    const record = normalizeRecord({
      place: {
        metadata: {
          placeId: ' abc123 ',
        },
      },
    });

    expect(record).not.toBeNull();
    expect(normalizeRecord(null)).toBeNull();
    expect(normalizeRecord(['not', 'record'])).toBeNull();
    expect(pickNestedText(record, ['place', 'metadata', 'placeId'])).toBe('abc123');
    expect(pickNestedText(record, ['place', 'missing'])).toBeNull();
  });

  it('normalizes JSON arrays through a mapper', () => {
    expect(
      normalizeJsonArray([' one ', '', 2, 'two'], (item) =>
        typeof item === 'string' ? normalizeText(item) : null,
      ),
    ).toEqual(['one', 'two']);
    expect(normalizeJsonArray('not-array', () => 'value')).toEqual([]);
  });

  it('keeps unique strings in first-seen order', () => {
    expect(uniqueStrings(['a', 'b', 'a', 'c', 'b'])).toEqual(['a', 'b', 'c']);
  });

  it('casts JSON payloads and hashes payloads stably', () => {
    expect(toJson({ a: 1 })).toEqual({ a: 1 });
    expect(buildPayloadHash({ a: 1 })).toBe(
      '015abd7f5cc57a2dd94b7590f04ad8084273905ee33ec5cebeae62276a97f862',
    );
  });
});
