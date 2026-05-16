import { describe, expect, it } from 'vitest';

import { classifyQaCommandFailure } from '@/scripts/qa/pr-baseline';

import type { QaCommand } from '@/scripts/qa/changed-path-selector';

const command: QaCommand = {
  args: ['run', 'build'],
  defaultFailureClass: 'product',
  id: 'baseline:build',
  phase: 'baseline',
  reason: 'test command',
};

describe('PR baseline failure classification', () => {
  it('separates missing local setup from product failures', () => {
    expect(classifyQaCommandFailure(command, 'Environment validation failed: missing env')).toBe(
      'missing-setup',
    );
  });

  it('labels existing shadcn strict migration inventory separately from product failures', () => {
    expect(
      classifyQaCommandFailure(
        { ...command, id: 'baseline:lint' },
        'Failed strict mode: 37 remaining non-color shadcn migration finding(s).',
      ),
    ).toBe('baseline-debt');
  });

  it('labels existing Luma inventory separately from product failures', () => {
    expect(
      classifyQaCommandFailure(
        { ...command, id: 'ui:luma-guard' },
        'Failed --fail-on=exception: Luma compliance findings remain.',
      ),
    ).toBe('baseline-debt');
  });

  it('defaults unknown command failures to the command failure class', () => {
    expect(classifyQaCommandFailure(command, 'Type error in src/app/page.tsx')).toBe('product');
  });
});
