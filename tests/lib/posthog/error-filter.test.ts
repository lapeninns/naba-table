import { describe, expect, it } from 'vitest';

import {
  filterPosthogEventBeforeSend,
  getPosthogSuppressionDebugState,
  matchPosthogExceptionSuppression,
  recordSuppressedPosthogException,
  shouldSuppressPosthogExceptionEvent,
} from '@/lib/posthog/error-filter';

describe('shouldSuppressPosthogExceptionEvent', () => {
  it('returns structured suppression match details for noisy exceptions', () => {
    const match = matchPosthogExceptionSuppression({
      event: '$exception',
      properties: {
        $exception_values: [
          'Non-Error promise rejection captured with value: Object Not Found Matching Id:2, MethodName:update, ParamCount:4',
        ],
      },
    });

    expect(match).toEqual({
      key: 'indexeddb_update_object_not_found',
      message:
        'Non-Error promise rejection captured with value: Object Not Found Matching Id:2, MethodName:update, ParamCount:4',
    });
  });

  it('suppresses known noisy indexeddb update rejection from exception values', () => {
    const shouldSuppress = shouldSuppressPosthogExceptionEvent({
      event: '$exception',
      properties: {
        $exception_values: [
          'Non-Error promise rejection captured with value: Object Not Found Matching Id:2, MethodName:update, ParamCount:4',
        ],
      },
    });

    expect(shouldSuppress).toBe(true);
  });

  it('returns null from the PostHog before_send filter for explicitly suppressed exceptions', () => {
    const result = filterPosthogEventBeforeSend({
      event: '$exception',
      properties: {
        $exception_values: [
          'Non-Error promise rejection captured with value: Object Not Found Matching Id:2, MethodName:update, ParamCount:4',
        ],
      },
    });

    expect(result).toBeNull();
  });

  it('suppresses known noisy indexeddb update rejection from exception list fallback', () => {
    const shouldSuppress = shouldSuppressPosthogExceptionEvent({
      event: '$exception',
      properties: {
        $exception_list: [
          {
            value:
              'Non-Error promise rejection captured with value: Object Not Found Matching Id:4, MethodName:update, ParamCount:4',
          },
        ],
      },
    });

    expect(shouldSuppress).toBe(true);
  });

  it('does not suppress non-matching exception messages', () => {
    const shouldSuppress = shouldSuppressPosthogExceptionEvent({
      event: '$exception',
      properties: {
        $exception_values: [
          'Non-Error promise rejection captured with value: Object Not Found Matching Id:4, MethodName:insert, ParamCount:4',
        ],
      },
    });

    expect(shouldSuppress).toBe(false);
  });

  it('does not suppress non-exception events', () => {
    const shouldSuppress = shouldSuppressPosthogExceptionEvent({
      event: '$pageview',
      properties: {
        $exception_values: [
          'Non-Error promise rejection captured with value: Object Not Found Matching Id:2, MethodName:update, ParamCount:4',
        ],
      },
    });

    expect(shouldSuppress).toBe(false);
  });

  it('handles missing properties safely', () => {
    expect(shouldSuppressPosthogExceptionEvent(null)).toBe(false);
    expect(shouldSuppressPosthogExceptionEvent(undefined)).toBe(false);
    expect(shouldSuppressPosthogExceptionEvent({ event: '$exception' })).toBe(false);
  });

  it('records suppression details in browser debug state', () => {
    const debugBefore = getPosthogSuppressionDebugState();
    if (!debugBefore) {
      throw new Error('expected browser debug state in jsdom environment');
    }
    const baseline = debugBefore.suppressedCountByKey.indexeddb_update_object_not_found;

    const match = matchPosthogExceptionSuppression({
      event: '$exception',
      properties: {
        $exception_values: [
          'Non-Error promise rejection captured with value: Object Not Found Matching Id:3, MethodName:update, ParamCount:4',
        ],
      },
    });

    if (!match) {
      throw new Error('expected a suppression match');
    }

    recordSuppressedPosthogException(match);

    const debugAfter = getPosthogSuppressionDebugState();
    if (!debugAfter) {
      throw new Error('expected browser debug state in jsdom environment');
    }

    expect(debugAfter.suppressedCountByKey.indexeddb_update_object_not_found).toBe(baseline + 1);
    expect(debugAfter.recentSuppressed.length).toBeGreaterThan(0);
    expect(debugAfter.recentSuppressed[0]?.key).toBe('indexeddb_update_object_not_found');
    expect(debugAfter.recentSuppressed[0]?.path).toContain('/');
  });
});
