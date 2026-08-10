import { describe, expect, it } from 'vitest';

import {
  isDualSyncDecisionAction,
  isDualSyncDirectionIntent,
  isDualSyncFieldState,
} from '@/server/dual-sync/types';

describe('existing dual-sync boundary guards', () => {
  it('accepts only the public decision actions when parsing untrusted values', () => {
    // Given
    const values: readonly unknown[] = [
      'import_from_google',
      'export_to_google',
      'ignore',
      'publish_everything',
      null,
    ];

    // When
    const accepted = values.filter(isDualSyncDecisionAction);

    // Then
    expect(accepted).toEqual(['import_from_google', 'export_to_google', 'ignore']);
  });

  it('keeps direction intent distinct from a public decision action', () => {
    // Given
    const importDecision = 'import_from_google';
    const importIntent = 'import_to_nabatable';

    // When
    const result = {
      decisionAsIntent: isDualSyncDirectionIntent(importDecision),
      intentAsDecision: isDualSyncDecisionAction(importIntent),
    };

    // Then
    expect(result).toEqual({ decisionAsIntent: false, intentAsDecision: false });
  });

  it('rejects an unknown public field state', () => {
    // Given
    const untrustedState: unknown = 'write_succeeded';

    // When
    const accepted = isDualSyncFieldState(untrustedState);

    // Then
    expect(accepted).toBe(false);
  });
});
