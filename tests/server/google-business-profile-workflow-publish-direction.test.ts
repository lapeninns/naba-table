import { describe, expect, it } from 'vitest';

import {
  assertApprovalWorkflowDirectionSupported,
  directionIntentForPublishMode,
  normalizePublishDirectionIntent,
  publishModeForDirectionIntent,
  pushToGoogleForDirectionIntent,
} from '@/server/google-business-profile/workflowPublishDirection';

describe('google business profile workflow publish direction helpers', () => {
  it('maps publish modes to direction intents and back', () => {
    expect(directionIntentForPublishMode('nabatable_only')).toBe('google_to_nabatable');
    expect(directionIntentForPublishMode('nabatable_and_google')).toBe(
      'google_to_nabatable_with_google_sync',
    );
    expect(directionIntentForPublishMode('google_only')).toBe('nabatable_to_google');

    expect(publishModeForDirectionIntent('google_to_nabatable')).toBe('nabatable_only');
    expect(publishModeForDirectionIntent('google_to_nabatable_with_google_sync')).toBe(
      'nabatable_and_google',
    );
    expect(publishModeForDirectionIntent('nabatable_to_google')).toBe('google_only');
  });

  it('normalizes the legacy Google push flag without changing conflict behavior', () => {
    expect(normalizePublishDirectionIntent({})).toBe('google_to_nabatable');
    expect(normalizePublishDirectionIntent({ pushToGoogle: true })).toBe(
      'google_to_nabatable_with_google_sync',
    );
    expect(normalizePublishDirectionIntent({ pushToGoogle: false })).toBe('google_to_nabatable');
    expect(
      normalizePublishDirectionIntent({
        directionIntent: 'google_to_nabatable_with_google_sync',
        pushToGoogle: true,
      }),
    ).toBe('google_to_nabatable_with_google_sync');

    expect(() =>
      normalizePublishDirectionIntent({
        directionIntent: 'google_to_nabatable',
        pushToGoogle: true,
      }),
    ).toThrow(/conflicts/i);
  });

  it('identifies which direction intents push changes to Google', () => {
    expect(pushToGoogleForDirectionIntent('google_to_nabatable')).toBe(false);
    expect(pushToGoogleForDirectionIntent('google_to_nabatable_with_google_sync')).toBe(true);
    expect(pushToGoogleForDirectionIntent('nabatable_to_google')).toBe(true);
  });

  it('throws the workflow conflict error for unsupported direction intents', () => {
    let captured: Error | null = null;
    try {
      assertApprovalWorkflowDirectionSupported('sideways' as never);
    } catch (error) {
      captured = error as Error;
    }

    expect(captured?.name).toBe('GBP_DIRECTION_CONFLICT');
    expect(captured?.message).toMatch(/unsupported/i);
  });
});
