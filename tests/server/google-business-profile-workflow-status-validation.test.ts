import { describe, expect, it } from 'vitest';

import {
  assertDraftEditable,
  assertDraftPublishable,
  createDraftStateError,
  EDITABLE_DRAFT_STATUSES,
  formatDraftStatus,
  GOOGLE_RETRYABLE_JOB_STATUSES,
  PUBLISHABLE_DRAFT_STATUSES,
  READ_ONLY_REVIEW_DRAFT_STATUSES,
} from '@/server/google-business-profile/workflowStatusValidation';

describe('google business profile workflow status validation', () => {
  it('keeps draft status policy explicit for editable, publishable, and read-only states', () => {
    expect(EDITABLE_DRAFT_STATUSES).toEqual([
      'review_ready',
      'approved',
      'failed',
      'partially_published',
    ]);
    expect(PUBLISHABLE_DRAFT_STATUSES).toEqual(['approved', 'failed', 'partially_published']);
    expect(READ_ONLY_REVIEW_DRAFT_STATUSES).toEqual(['published', 'publishing', 'archived']);
  });

  it('keeps Google retryable job statuses explicit', () => {
    expect(GOOGLE_RETRYABLE_JOB_STATUSES).toEqual(['google_failed', 'partially_published']);
  });

  it('allows only editable draft states to be changed', () => {
    expect(() => assertDraftEditable('review_ready')).not.toThrow();
    expect(() => assertDraftEditable('failed')).not.toThrow();
    expect(() => assertDraftEditable('published')).toThrow(/cannot be changed/i);
  });

  it('requires approval before publishing and allows resumable publish states', () => {
    expect(() => assertDraftPublishable('approved')).not.toThrow();
    expect(() => assertDraftPublishable('failed')).not.toThrow();
    expect(() => assertDraftPublishable('partially_published')).not.toThrow();

    let captured: Error | null = null;
    try {
      assertDraftPublishable('review_ready');
    } catch (error) {
      captured = error as Error;
    }

    expect(captured?.name).toBe('GBP_DRAFT_NOT_APPROVED');
    expect(captured?.message).toMatch(/review and approve/i);
    expect(() => assertDraftPublishable('publishing')).toThrow(/cannot be applied/i);
  });

  it('formats draft state errors consistently for orchestration callers', () => {
    expect(formatDraftStatus('partially_published')).toBe('partially published');

    const error = createDraftStateError('partially_published', 'edit');
    expect(error.name).toBe('GBP_DRAFT_INVALID_STATE');
    expect(error.message).toContain('partially published');
    expect(error.message).toContain('cannot be changed');
  });
});
