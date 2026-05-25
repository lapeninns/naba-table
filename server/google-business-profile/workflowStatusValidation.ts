export const EDITABLE_DRAFT_STATUSES = [
  'review_ready',
  'approved',
  'failed',
  'partially_published',
];
export const PUBLISHABLE_DRAFT_STATUSES = ['approved', 'failed', 'partially_published'];
export const READ_ONLY_REVIEW_DRAFT_STATUSES = ['published', 'publishing', 'archived'];
export const APPROVAL_REQUIRED_DRAFT_STATUS = 'review_ready';
export const GOOGLE_RETRYABLE_JOB_STATUSES = ['google_failed', 'partially_published'];

export function formatDraftStatus(status: string): string {
  return status.replaceAll('_', ' ');
}

function createNamedWorkflowError(name: string, message: string): Error {
  const error = new Error(message);
  error.name = name;
  return error;
}

export function createDraftStateError(status: string, action: 'edit' | 'publish'): Error {
  const verb = action === 'edit' ? 'changed' : 'applied';
  const guidance = 'Check for changes again before continuing.';
  const error = new Error(
    `Google Business Profile review is ${formatDraftStatus(status)} and cannot be ${verb}. ${guidance}`,
  );
  error.name = 'GBP_DRAFT_INVALID_STATE';
  return error;
}

export function assertDraftEditable(status: string): void {
  if (!EDITABLE_DRAFT_STATUSES.includes(status)) {
    throw createDraftStateError(status, 'edit');
  }
}

export function assertDraftPublishable(status: string): void {
  if (status === APPROVAL_REQUIRED_DRAFT_STATUS) {
    throw createNamedWorkflowError(
      'GBP_DRAFT_NOT_APPROVED',
      'Review and approve the selected Google profile changes before applying them.',
    );
  }
  if (!PUBLISHABLE_DRAFT_STATUSES.includes(status)) {
    throw createDraftStateError(status, 'publish');
  }
}
